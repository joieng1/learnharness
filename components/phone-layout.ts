/**
 * Phone layout decisions (upstream PR #243, lh-m5s) — pure functions, no
 * DOM. The client provider (phone-layout-context.tsx) feeds them the live
 * viewport; every responsive surface reads the result instead of guessing
 * from CSS.
 *
 * Touch scope (port decision D2): every touch-only affordance — Enter types
 * a newline, the session row's "⋯" button, always-visible copy corners, the
 * 44px confidence hit box — requires a NARROW BROWSER as well as touch.
 * iPads, touch laptops, and the Electron shell keep today's desktop
 * behaviour at any width.
 */

/** Below this width the 288px sidebar would squeeze the page under its
 *  640px floor (640 + 288). Mirrors SIDEBAR_AUTOCLOSE in electron/main.cjs
 *  and the 927.98px media queries in app/globals.css
 *  (tests/phone-layout.test.ts pins all three). */
export const NARROW_WIDTH = 928;

/** desktop = inline sidebar; overlay = narrow browser, the session list
 *  floats over a full-width page; electron-narrow = the desktop shell's
 *  existing auto-close + window-widen path. */
export type ShellMode = "desktop" | "overlay" | "electron-narrow";

export type CopyControls = "visible" | "hover-reveal";

/** Finger-sized (Apple HIG) vs the painted 16px confidence rail. */
export const TOUCH_HIT_HEIGHT = 44;
export const RAIL_HIT_HEIGHT = 16;
export type ConfidenceHitHeight = typeof TOUCH_HIT_HEIGHT | typeof RAIL_HIT_HEIGHT;

export interface PhoneLayout {
	shell: ShellMode;
	/** A narrow browser driven by a finger — the gate for every touch-only
	 *  affordance (D2), including the session row's "⋯" menu button. */
	touchPhone: boolean;
	/** Enter in a text field types a newline; the Send/Submit buttons submit. */
	enterInsertsNewline: boolean;
	/** Copy/expand corners on code, tables, and math. */
	copyControls: CopyControls;
	/** The confidence slider's hit box in px. */
	confidenceHitHeight: ConfidenceHitHeight;
	/** Settings and setup render as full-screen sheets. */
	sheetDialogs: boolean;
	/** The session title drops to the compact scale. */
	compactTitle: boolean;
	/** Control rows (stats, home mode/dictate/model) wrap instead of overflowing. */
	wrapControls: boolean;
	/** Graph tools: one row, or search alone above the other tools. */
	graphToolRows: 1 | 2;
	/** Node detail: anchored at the tap point, or pinned to the bottom. */
	nodeCard: "anchor" | "bottom-sheet";
}

export interface ViewportFacts {
	width: number;
	/** The Electron preload bridge is present (not merely an Electron UA). */
	electron: boolean;
	coarsePointer: boolean;
	canHover: boolean;
}

function shellMode({ width, electron }: Pick<ViewportFacts, "width" | "electron">): ShellMode {
	if (width >= NARROW_WIDTH) return "desktop";
	return electron ? "electron-narrow" : "overlay";
}

export function phoneLayout(input: ViewportFacts): PhoneLayout {
	const shell = shellMode(input);
	const overlay = shell === "overlay";
	const touchPhone = overlay && input.coarsePointer;
	return {
		shell,
		touchPhone,
		enterInsertsNewline: touchPhone,
		copyControls: copyVisibility({ canHover: input.canHover, narrowBrowser: overlay }),
		confidenceHitHeight: confidenceHitHeight(touchPhone),
		sheetDialogs: overlay,
		compactTitle: overlay,
		wrapControls: overlay,
		graphToolRows: overlay ? 2 : 1,
		nodeCard: overlay ? "bottom-sheet" : "anchor",
	};
}

/** Whether the session list is showing. Desktop follows the persisted
 *  preference; Electron-narrow auto-closes; the overlay has its own
 *  transient state, so a stored "open" never covers a phone on arrival. */
export function sidebarOpen(input: { shell: ShellMode; preference: boolean; overlayOpen: boolean }): boolean {
	if (input.shell === "desktop") return input.preference;
	if (input.shell === "electron-narrow") return false;
	return input.overlayOpen;
}

/** What the sidebar toggle does in each shell. */
export function sidebarToggleAction(input: {
	shell: ShellMode;
	preference: boolean;
}): "flip-preference" | "flip-overlay" | "widen-window" {
	if (input.shell === "overlay") return "flip-overlay";
	if (input.shell === "electron-narrow" && !input.preference) return "widen-window";
	return "flip-preference";
}

export type OverlayDrawerEvent = "toggle" | "backdrop" | "navigate" | "escape";

/** The overlay drawer's transient open state: only a toggle opens it;
 *  every other event (backdrop tap, navigation, Escape) closes it. */
export function overlayDrawer(open: boolean, event: OverlayDrawerEvent): boolean {
	return event === "toggle" ? !open : false;
}

/** The session top bar's height (h-15) — the dock never grows under it. */
const TOP_CHROME = 60;
/** The smallest dock scroll area that still shows a question. */
const MIN_DOCK = 120;

/** Where the on-screen keyboard leaves the bottom dock. iOS keeps the
 *  layout viewport (and dvh) full height while the keyboard covers its
 *  bottom, so the dock lifts by the covered height; with the keyboard
 *  down only the home indicator needs clearing. */
export function keyboardInset(input: {
	layoutHeight: number;
	visualHeight: number;
	offsetTop: number;
	safeAreaBottom: number;
}): { bottomInset: number; dockMaxHeight: number } {
	const overlap = Math.max(0, input.layoutHeight - input.visualHeight - input.offsetTop);
	const bottomInset = overlap > 0 ? overlap : input.safeAreaBottom;
	const dockMaxHeight = Math.max(MIN_DOCK, input.visualHeight - TOP_CHROME - bottomInset);
	return { bottomInset, dockMaxHeight };
}

/** The dock's scroll-area cap: the measured column's cap, never taller
 *  than the space the keyboard leaves. */
export function capDockHeight(measured: number, keyboardMax: number): number {
	return Math.min(measured, keyboardMax);
}

/** What Enter does in a text field. A phone keyboard has no Shift+Enter, so
 *  where Enter inserts newlines the Send/Submit button submits; ⌘/Ctrl+Enter
 *  submits everywhere. Callers pass the layout's `enterInsertsNewline`.
 *  `explicitSubmit` is an Enter the app dispatched to submit a field (the
 *  citation popover's Send) — a request, not typing, so the layout never
 *  turns it into a newline. */
export function enterKey(input: {
	enterInsertsNewline: boolean;
	shiftKey: boolean;
	metaKey: boolean;
	ctrlKey: boolean;
	explicitSubmit?: boolean;
}): "newline" | "submit" {
	if (input.explicitSubmit || input.metaKey || input.ctrlKey) return "submit";
	if (input.enterInsertsNewline || input.shiftKey) return "newline";
	return "submit";
}

/** Copy corners: hover-revealed where hover exists; always shown on a
 *  narrow browser without hover (D2 — a wide hoverless device keeps
 *  today's reveal, where the corners stay tappable). */
export function copyVisibility(input: { canHover: boolean; narrowBrowser: boolean }): CopyControls {
	return input.narrowBrowser && !input.canHover ? "visible" : "hover-reveal";
}

/** The confidence slider's hit box — a finger-sized target on a touch
 *  phone; the painted rail never changes. */
export function confidenceHitHeight(touchPhone: boolean): ConfidenceHitHeight {
	return touchPhone ? TOUCH_HIT_HEIGHT : RAIL_HIT_HEIGHT;
}

/** The 22rem desktop model-menu width. */
const MODEL_MENU_WIDTH = 352;
/** 12px gutter on each side of a viewport-capped menu. */
const MODEL_MENU_GUTTERS = 24;

/** Model menus: the desktop width, capped to the viewport with a gutter. */
export function modelMenuWidth(viewportWidth: number): number {
	return Math.min(MODEL_MENU_WIDTH, viewportWidth - MODEL_MENU_GUTTERS);
}

/** Merged (cn) over a centred dialog frame when `sheetDialogs`: the frame
 *  fills the phone screen, clear of the notch and the home indicator. */
export const SHEET_DIALOG_FRAME =
	"h-dvh max-h-none w-screen max-w-none rounded-none border-0 pb-[env(safe-area-inset-bottom)] pt-[env(safe-area-inset-top)]";

/** Travel in px that turns a press into a pan (the graph's click slop). */
export const GESTURE_SLOP = 4;
/** A still press held this long opens the node's context menu on touch. */
export const LONG_PRESS_MS = 500;

export function pointerGesture({ holdMs, travelPx }: { holdMs: number; travelPx: number }): "tap" | "pan" | "long-press" {
	if (travelPx >= GESTURE_SLOP) return "pan";
	if (holdMs >= LONG_PRESS_MS) return "long-press";
	return "tap";
}

/** The server render and the first client render (before the viewport is
 *  read) — the desktop app, so hydration matches today's markup. */
export const DESKTOP_LAYOUT: PhoneLayout = phoneLayout({
	width: NARROW_WIDTH,
	electron: false,
	coarsePointer: false,
	canHover: true,
});
