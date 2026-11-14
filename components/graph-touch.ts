import { GESTURE_SLOP } from "./phone-layout.ts";

/**
 * Touch decisions for the graph canvas — pure, so they are pinned by
 * tests (the renderer class itself is DOM-bound and verified live).
 */

export type LongPressEvent =
	| { kind: "pointerdown" }
	| { kind: "fire" }
	| { kind: "contextmenu" };

export interface LongPressGate {
	fired: boolean;
	swallowContextMenu: boolean;
}

/**
 * Whether a contextmenu is the browser's echo of a touch hold that already
 * opened the node menu. Android follows a hold with its own contextmenu;
 * iOS never does. So the "fired" mark is consumed by the first contextmenu
 * AND cleared by any new press — otherwise (upstream PR #243) it lingered
 * and swallowed the next right-click or empty-stage long-press.
 */
export function longPressGate(fired: boolean, event: LongPressEvent): LongPressGate {
	if (event.kind === "fire") return { fired: true, swallowContextMenu: false };
	if (event.kind === "contextmenu") return { fired: false, swallowContextMenu: fired };
	return { fired: false, swallowContextMenu: false };
}

export interface Camera {
	k: number;
	x: number;
	y: number;
}

/** A relative scale change below this is rounding, not a zoom. */
const SCALE_JITTER = 0.01;

/**
 * Whether the camera really moved since `from` (the camera when the node
 * card or menu opened). d3-zoom emits a zoom event on every touchmove, and
 * a finger held still for the long-press still drifts a pixel or two — a
 * drift under the gesture slop must not close the menu it just opened.
 * No recorded camera keeps today's rule: any camera event closes.
 */
export function isCameraMove(from: Camera | null, to: Camera): boolean {
	if (from === null) return true;
	const zoomed = Math.abs(to.k / from.k - 1) >= SCALE_JITTER;
	const panned = Math.hypot(to.x - from.x, to.y - from.y) >= GESTURE_SLOP;
	return zoomed || panned;
}
