/**
 * Graph touch decisions (Stage 3 port of upstream PR #243): the long-press
 * context-menu gate and the camera-jitter filter. Both pin bugs found in
 * the PR's renderer code during the port.
 */

import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isCameraMove, longPressGate, type LongPressEvent } from "../components/graph-touch.ts";

// Every press clears the mark, whatever the button or target — the names
// keep each scenario readable.
const PRESS: LongPressEvent = { kind: "pointerdown" };
const NODE_PRESS = PRESS;
const STAGE_PRESS = PRESS;
const RIGHT_PRESS = PRESS;
const FIRE: LongPressEvent = { kind: "fire" };
const CONTEXT_MENU: LongPressEvent = { kind: "contextmenu" };

/** Runs events through the gate; returns whether each contextmenu was swallowed. */
function swallowedMenus(events: LongPressEvent[]): boolean[] {
	let fired = false;
	const swallowed: boolean[] = [];
	for (const event of events) {
		const next = longPressGate(fired, event);
		fired = next.fired;
		if (event.kind === "contextmenu") swallowed.push(next.swallowContextMenu);
	}
	return swallowed;
}

describe("longPressGate (the touch long-press opens the node menu once)", () => {
	it("swallows the browser's own contextmenu that follows a fired hold", () => {
		assert.deepEqual(swallowedMenus([NODE_PRESS, FIRE, CONTEXT_MENU]), [true]);
	});

	it("lets a plain right-click through when no hold fired", () => {
		assert.deepEqual(swallowedMenus([RIGHT_PRESS, CONTEXT_MENU]), [false]);
	});

	it("swallows only once: a later contextmenu after a fired hold opens normally", () => {
		assert.deepEqual(swallowedMenus([NODE_PRESS, FIRE, CONTEXT_MENU, CONTEXT_MENU]), [true, false]);
	});

	it("a later right-click (hybrid laptop) is not swallowed when no browser menu followed the hold (iOS)", () => {
		assert.deepEqual(swallowedMenus([NODE_PRESS, FIRE, RIGHT_PRESS, CONTEXT_MENU]), [false]);
	});

	it("a later empty-stage long-press (Android) is not swallowed", () => {
		assert.deepEqual(swallowedMenus([NODE_PRESS, FIRE, STAGE_PRESS, CONTEXT_MENU]), [false]);
	});
});

describe("isCameraMove (finger jitter is not a camera move)", () => {
	const at = { k: 1.5, x: 120, y: -40 };

	it("an identical transform (d3 fires zoom on every touchmove) is not a move", () => {
		assert.equal(isCameraMove(at, { ...at }), false);
	});

	it("sub-slop jitter after a long-press is not a move", () => {
		assert.equal(isCameraMove(at, { k: 1.5, x: 122, y: -38.5 }), false);
	});

	it("a pan past the gesture slop is a move", () => {
		assert.equal(isCameraMove(at, { k: 1.5, x: 125, y: -40 }), true);
	});

	it("a real zoom is a move even without translation", () => {
		assert.equal(isCameraMove(at, { k: 1.6, x: 120, y: -40 }), true);
	});

	it("with no camera recorded at open time, any event closes (today's behaviour)", () => {
		assert.equal(isCameraMove(null, at), true);
	});
});
