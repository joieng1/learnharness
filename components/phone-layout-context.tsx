"use client";

import { createContext, useContext, useLayoutEffect, useState } from "react";
import { DESKTOP_LAYOUT, keyboardInset, modelMenuWidth, phoneLayout, type PhoneLayout } from "@/components/phone-layout";

/**
 * Live phone layout (upstream PR #243, lh-m5s): reads the viewport in a
 * layout effect, so the real layout lands before the first client paint.
 *
 * First-paint motion (port decision D7) is NOT handled here: consumers that
 * animate (the sidebar drawer) already gate their transitions on their own
 * post-mount flag, which flips after this provider's layout effect — so
 * the server-rendered desktop markup swaps to the phone layout without a
 * visible slide. Keeping that rule at the animating site keeps this
 * provider a plain fact source.
 */

export type LiveLayout = PhoneLayout & {
	coarsePointer: boolean;
	canHover: boolean;
	viewportWidth: number;
};

const COARSE_POINTER_QUERY = "(pointer: coarse)";
const HOVER_QUERY = "(hover: hover)";

const SERVER_LAYOUT: LiveLayout = { ...DESKTOP_LAYOUT, coarsePointer: false, canHover: true, viewportWidth: Infinity };

const PhoneLayoutContext = createContext<LiveLayout>(SERVER_LAYOUT);

export function usePhoneLayout(): LiveLayout {
	return useContext(PhoneLayoutContext);
}

function readLayout(): LiveLayout {
	const coarsePointer = window.matchMedia(COARSE_POINTER_QUERY).matches;
	const canHover = window.matchMedia(HOVER_QUERY).matches;
	// The preload bridge, not the user agent (upstream 3f61421): other
	// Electron hosts (an editor's embedded browser) have no bridge to widen
	// the window.
	const electron = window.lh !== undefined;
	const width = window.innerWidth;
	return { ...phoneLayout({ width, electron, coarsePointer, canHover }), coarsePointer, canHover, viewportWidth: width };
}

/** Every derived field is a function of these, so they decide equality. */
function sameLayout(a: LiveLayout, b: LiveLayout): boolean {
	return (
		a.shell === b.shell &&
		a.coarsePointer === b.coarsePointer &&
		a.canHover === b.canHover &&
		a.viewportWidth === b.viewportWidth
	);
}

export type KeyboardInset = { bottomInset: number; dockMaxHeight: number };

const NO_KEYBOARD: KeyboardInset = { bottomInset: 0, dockMaxHeight: Infinity };

/** A visual-viewport scale above this is a pinch-zoom, not a keyboard. */
const PINCH_ZOOM_SCALE = 1.01;

const KeyboardInsetContext = createContext<KeyboardInset>(NO_KEYBOARD);

export function useModelMenuWidth(): number {
	return modelMenuWidth(usePhoneLayout().viewportWidth);
}

/** The keyboard's live inset — the docks read it to stay above the keyboard. */
export function useKeyboardInset(): KeyboardInset {
	return useContext(KeyboardInsetContext);
}

/** env() is only readable through a computed style, so a hidden probe
 *  carries the safe-area bottom as padding. */
function createSafeAreaProbe(): HTMLElement {
	const probe = document.createElement("div");
	probe.style.cssText = "position:fixed;visibility:hidden;pointer-events:none;padding-bottom:env(safe-area-inset-bottom)";
	document.body.appendChild(probe);
	return probe;
}

function readSafeAreaBottom(probe: HTMLElement): number {
	return Number.parseFloat(getComputedStyle(probe).paddingBottom) || 0;
}

function readKeyboardInset(probe: HTMLElement): KeyboardInset {
	const vv = window.visualViewport;
	const layoutHeight = document.documentElement.clientHeight;
	// Pinch-zoom also shrinks the visual viewport; a zoomed page reads as
	// keyboard-down rather than lifting the dock.
	const usable = !!vv && vv.scale <= PINCH_ZOOM_SCALE;
	return keyboardInset({
		layoutHeight,
		visualHeight: usable ? vv.height : layoutHeight,
		offsetTop: usable ? vv.offsetTop : 0,
		safeAreaBottom: readSafeAreaBottom(probe),
	});
}

/** Feeds keyboardInset from visualViewport and mirrors the inset into
 *  --lh-keyboard-inset for the CSS-positioned docks. */
function KeyboardInsetProvider({ children }: { children: React.ReactNode }) {
	const [inset, setInset] = useState<KeyboardInset>(NO_KEYBOARD);
	useLayoutEffect(() => {
		const vv = window.visualViewport;
		const probe = createSafeAreaProbe();
		const update = () => {
			const next = readKeyboardInset(probe);
			document.documentElement.style.setProperty("--lh-keyboard-inset", `${next.bottomInset}px`);
			setInset((prev) =>
				prev.bottomInset === next.bottomInset && prev.dockMaxHeight === next.dockMaxHeight ? prev : next,
			);
		};
		update();
		vv?.addEventListener("resize", update);
		vv?.addEventListener("scroll", update);
		window.addEventListener("resize", update);
		return () => {
			vv?.removeEventListener("resize", update);
			vv?.removeEventListener("scroll", update);
			window.removeEventListener("resize", update);
			probe.remove();
			document.documentElement.style.removeProperty("--lh-keyboard-inset");
		};
	}, []);
	return <KeyboardInsetContext.Provider value={inset}>{children}</KeyboardInsetContext.Provider>;
}

/** Root-layout provider: the server and first client render are the desktop
 *  layout (hydration matches); the real viewport lands before first paint. */
export function PhoneLayoutProvider({ children }: { children: React.ReactNode }) {
	const [layout, setLayout] = useState<LiveLayout>(SERVER_LAYOUT);
	useLayoutEffect(() => {
		const update = () => {
			const next = readLayout();
			setLayout((prev) => (sameLayout(prev, next) ? prev : next));
		};
		update();
		const pointer = window.matchMedia(COARSE_POINTER_QUERY);
		const hover = window.matchMedia(HOVER_QUERY);
		window.addEventListener("resize", update);
		pointer.addEventListener("change", update);
		hover.addEventListener("change", update);
		return () => {
			window.removeEventListener("resize", update);
			pointer.removeEventListener("change", update);
			hover.removeEventListener("change", update);
		};
	}, []);
	return (
		<PhoneLayoutContext.Provider value={layout}>
			<KeyboardInsetProvider>{children}</KeyboardInsetProvider>
		</PhoneLayoutContext.Provider>
	);
}
