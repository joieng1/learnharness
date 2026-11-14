/**
 * Phone layout decisions (upstream PR #243, lh-m5s): the pure seams the
 * responsive UI reads. Ported with port decision D2: touch affordances
 * require a narrow browser as well as touch.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
	NARROW_WIDTH, RAIL_HIT_HEIGHT, TOUCH_HIT_HEIGHT, capDockHeight, confidenceHitHeight, copyVisibility, enterKey,
	keyboardInset, modelMenuWidth, overlayDrawer, phoneLayout, pointerGesture, sidebarOpen, sidebarToggleAction,
} from "../components/phone-layout.ts";

const PHONE = { width: 390, electron: false, coarsePointer: true, canHover: false };
const DESKTOP = { width: 1200, electron: false, coarsePointer: false, canHover: true };
const NARROW_ELECTRON = { width: 800, electron: true, coarsePointer: false, canHover: true };
/** An iPad in landscape: touch, no hover, but at least NARROW_WIDTH wide. */
const WIDE_TOUCH = { width: 1180, electron: false, coarsePointer: true, canHover: false };
/** A touchscreen laptop with a narrow window in Electron. */
const NARROW_TOUCH_ELECTRON = { width: 800, electron: true, coarsePointer: true, canHover: false };

describe("phoneLayout", () => {
	it("a 390px browser is an overlay shell with sheet dialogs and a compact title", () => {
		const layout = phoneLayout(PHONE);
		assert.equal(layout.shell, "overlay");
		assert.equal(layout.sheetDialogs, true);
		assert.equal(layout.compactTitle, true);
	});

	it("a 1200px window is the desktop shell", () => {
		const layout = phoneLayout(DESKTOP);
		assert.equal(layout.shell, "desktop");
		assert.equal(layout.sheetDialogs, false);
		assert.equal(layout.compactTitle, false);
	});

	it("exactly NARROW_WIDTH is desktop; one pixel less is the overlay", () => {
		assert.equal(phoneLayout({ ...PHONE, width: NARROW_WIDTH }).shell, "desktop");
		assert.equal(phoneLayout({ ...PHONE, width: NARROW_WIDTH - 1 }).shell, "overlay");
	});

	it("Electron at 800px stays electron-narrow and never becomes an overlay", () => {
		const layout = phoneLayout(NARROW_ELECTRON);
		assert.equal(layout.shell, "electron-narrow");
		assert.equal(layout.sheetDialogs, false);
	});

	it("overlay wraps controls, splits graph tools into two rows, and docks the node card at the bottom", () => {
		const layout = phoneLayout(PHONE);
		assert.equal(layout.wrapControls, true);
		assert.equal(layout.graphToolRows, 2);
		assert.equal(layout.nodeCard, "bottom-sheet");
	});

	it("desktop and electron-narrow keep one control row, one tool row, and the anchored node card", () => {
		for (const layout of [phoneLayout(DESKTOP), phoneLayout(NARROW_ELECTRON)]) {
			assert.equal(layout.wrapControls, false);
			assert.equal(layout.compactTitle, false);
			assert.equal(layout.graphToolRows, 1);
			assert.equal(layout.nodeCard, "anchor");
		}
	});
});

describe("touch affordances need a narrow browser (D2)", () => {
	it("a touch phone gets Enter-as-newline, the row menu, visible copy corners, and the 44px hit box", () => {
		const layout = phoneLayout(PHONE);
		assert.equal(layout.touchPhone, true);
		assert.equal(layout.enterInsertsNewline, true);
		assert.equal(layout.copyControls, "visible");
		assert.equal(layout.confidenceHitHeight, TOUCH_HIT_HEIGHT);
	});

	it("a wide touch device (iPad landscape) keeps every desktop behaviour", () => {
		const layout = phoneLayout(WIDE_TOUCH);
		assert.equal(layout.touchPhone, false);
		assert.equal(layout.enterInsertsNewline, false);
		assert.equal(layout.copyControls, "hover-reveal");
		assert.equal(layout.confidenceHitHeight, RAIL_HIT_HEIGHT);
	});

	it("a narrow touchscreen Electron window keeps every desktop behaviour", () => {
		const layout = phoneLayout(NARROW_TOUCH_ELECTRON);
		assert.equal(layout.touchPhone, false);
		assert.equal(layout.enterInsertsNewline, false);
		assert.equal(layout.copyControls, "hover-reveal");
	});

	it("a narrow mouse-driven browser window is an overlay but not a touch phone", () => {
		const layout = phoneLayout({ ...DESKTOP, width: 600 });
		assert.equal(layout.shell, "overlay");
		assert.equal(layout.touchPhone, false);
		assert.equal(layout.enterInsertsNewline, false);
		assert.equal(layout.copyControls, "hover-reveal");
	});
});

describe("the session drawer", () => {
	it("the overlay starts closed even when the stored desktop preference says open", () => {
		assert.equal(sidebarOpen({ shell: "overlay", preference: true, overlayOpen: false }), false);
	});

	it("the overlay opens on toggle, then closes on a backdrop tap", () => {
		const opened = overlayDrawer(false, "toggle");
		assert.equal(opened, true);
		assert.equal(overlayDrawer(opened, "backdrop"), false);
	});

	it("opening a session closes the overlay", () => {
		assert.equal(overlayDrawer(true, "navigate"), false);
	});

	it("Escape closes the overlay (D3)", () => {
		assert.equal(overlayDrawer(true, "escape"), false);
	});

	it("the desktop shell follows the stored preference", () => {
		assert.equal(sidebarOpen({ shell: "desktop", preference: true, overlayOpen: false }), true);
		assert.equal(sidebarOpen({ shell: "desktop", preference: false, overlayOpen: true }), false);
	});

	it("Electron under 928px still auto-closes and still asks the window to widen when opened", () => {
		assert.equal(sidebarOpen({ shell: "electron-narrow", preference: true, overlayOpen: true }), false);
		assert.equal(sidebarToggleAction({ shell: "electron-narrow", preference: false }), "widen-window");
	});

	it("Electron under 928px with the preference already open flips the preference, as before", () => {
		assert.equal(sidebarToggleAction({ shell: "electron-narrow", preference: true }), "flip-preference");
	});

	it("toggling on a narrow browser flips the overlay, never the stored preference", () => {
		assert.equal(sidebarToggleAction({ shell: "overlay", preference: true }), "flip-overlay");
		assert.equal(sidebarToggleAction({ shell: "desktop", preference: true }), "flip-preference");
	});
});

describe("keyboardInset", () => {
	it("a closed keyboard leaves only the home-indicator inset", () => {
		const inset = keyboardInset({ layoutHeight: 800, visualHeight: 800, offsetTop: 0, safeAreaBottom: 34 });
		assert.equal(inset.bottomInset, 34);
	});

	it("an open keyboard lifts the dock by the covered height and drops the home indicator", () => {
		const inset = keyboardInset({ layoutHeight: 800, visualHeight: 430, offsetTop: 0, safeAreaBottom: 34 });
		assert.equal(inset.bottomInset, 370);
		assert.equal(inset.dockMaxHeight, 120);
	});
});

describe("capDockHeight", () => {
	const openKeyboard = keyboardInset({ layoutHeight: 800, visualHeight: 430, offsetTop: 0, safeAreaBottom: 34 });

	it("a tall question card is capped to the open-keyboard dock height", () => {
		assert.equal(capDockHeight(700, openKeyboard.dockMaxHeight), 120);
	});

	it("a short card keeps its measured height", () => {
		assert.equal(capDockHeight(80, openKeyboard.dockMaxHeight), 80);
	});
});

describe("enterKey (text fields)", () => {
	const key = { shiftKey: false, metaKey: false, ctrlKey: false };

	it("an unmodified Enter where Enter inserts newlines types a newline", () => {
		assert.equal(enterKey({ ...key, enterInsertsNewline: true }), "newline");
	});

	it("an unmodified Enter elsewhere submits", () => {
		assert.equal(enterKey({ ...key, enterInsertsNewline: false }), "submit");
	});

	it("Shift+Enter types a newline", () => {
		assert.equal(enterKey({ ...key, enterInsertsNewline: false, shiftKey: true }), "newline");
	});

	it("Meta+Enter and Ctrl+Enter submit even where Enter inserts newlines", () => {
		assert.equal(enterKey({ ...key, enterInsertsNewline: true, metaKey: true }), "submit");
		assert.equal(enterKey({ ...key, enterInsertsNewline: true, ctrlKey: true }), "submit");
	});
});

describe("copyVisibility", () => {
	it("a narrow browser without hover keeps copy controls visible", () => {
		assert.equal(copyVisibility({ canHover: false, narrowBrowser: true }), "visible");
	});

	it("with hover, copy controls reveal on hover", () => {
		assert.equal(copyVisibility({ canHover: true, narrowBrowser: true }), "hover-reveal");
	});

	it("a wide device without hover keeps today's reveal (D2)", () => {
		assert.equal(copyVisibility({ canHover: false, narrowBrowser: false }), "hover-reveal");
	});
});

describe("confidenceHitHeight", () => {
	it("a touch phone gets a 44px confidence hit area", () => {
		assert.equal(confidenceHitHeight(true), 44);
	});

	it("everything else keeps the 16px confidence track", () => {
		assert.equal(confidenceHitHeight(false), 16);
	});
});

describe("pointerGesture", () => {
	it("a 500ms hold that travels 3px is a long-press", () => {
		assert.equal(pointerGesture({ holdMs: 500, travelPx: 3 }), "long-press");
	});

	it("4px of travel is a pan, however long the hold", () => {
		assert.equal(pointerGesture({ holdMs: 500, travelPx: 4 }), "pan");
	});

	it("a short still press is a tap", () => {
		assert.equal(pointerGesture({ holdMs: 100, travelPx: 0 }), "tap");
	});
});

describe("modelMenuWidth", () => {
	it("a 1200px viewport keeps the 352px menu", () => {
		assert.equal(modelMenuWidth(1200), 352);
	});

	it("a 300px viewport caps the menu at 276px", () => {
		assert.equal(modelMenuWidth(300), 276);
	});

	it("a 390px viewport still fits the 352px menu", () => {
		assert.equal(modelMenuWidth(390), 352);
	});
});

describe("one breakpoint everywhere (D8)", () => {
	const repoFile = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

	it("the Electron shell's auto-close width is NARROW_WIDTH", () => {
		const match = repoFile("electron/main.cjs").match(/const SIDEBAR_AUTOCLOSE = (\d+);/);
		assert.ok(match, "electron/main.cjs declares SIDEBAR_AUTOCLOSE");
		assert.equal(Number(match[1]), NARROW_WIDTH);
	});

	it("every narrow-width media query in globals.css stops just under NARROW_WIDTH", () => {
		/** max-width queries end a hair below the breakpoint so 928px is desktop. */
		const MEDIA_QUERY_EPSILON = 0.02;
		const widths = [...repoFile("app/globals.css").matchAll(/@media[^{]*max-width:\s*([\d.]+)px/g)].map((m) => Number(m[1]));
		assert.ok(widths.length > 0, "globals.css has a narrow-width media query");
		for (const width of widths) assert.equal(width, NARROW_WIDTH - MEDIA_QUERY_EPSILON);
	});
});
