/**
 * Phone control sizing (Tier 2 gaps G1, G2, G4): hit boxes, the stats
 * popover's alignment, and fixed-width menus capped to a phone screen —
 * each a no-op on desktop.
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import {
	CACHE_RETENTION_MENU_WIDTH, FONT_MENU_WIDTH, KEYS_MENU_WIDTH, TOUCH_HIT_CLASS, TOUCH_HIT_HEIGHT,
	cappedMenuWidth, statsPopoverAlign, touchHitClass,
} from "../components/phone-layout.ts";
import { cn } from "../lib/utils.ts";

const repoFile = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");
/** Tailwind's spacing unit and rem, in px. */
const TAILWIND_SPACING_PX = 4;
const REM_PX = 16;

describe("cappedMenuWidth (G4)", () => {
	it("a desktop viewport keeps the menu's own width", () => {
		assert.equal(cappedMenuWidth(CACHE_RETENTION_MENU_WIDTH, 1200), CACHE_RETENTION_MENU_WIDTH);
	});

	it("a 320px phone caps a 320px menu to leave a 12px gutter each side", () => {
		assert.equal(cappedMenuWidth(CACHE_RETENTION_MENU_WIDTH, 320), 296);
	});

	it("a 375px phone still fits the 288px menus", () => {
		assert.equal(cappedMenuWidth(FONT_MENU_WIDTH, 375), FONT_MENU_WIDTH);
		assert.equal(cappedMenuWidth(KEYS_MENU_WIDTH, 375), KEYS_MENU_WIDTH);
	});
});

describe("menu width constants match their desktop Tailwind classes", () => {
	it("the cache-retention menu is w-80", () => {
		assert.match(repoFile("components/settings/agent-section.tsx"), /menuClass="flex w-80 /);
		assert.equal(CACHE_RETENTION_MENU_WIDTH, 80 * TAILWIND_SPACING_PX);
	});

	it("the font menu is w-[18rem]", () => {
		assert.match(repoFile("components/settings/appearance-section.tsx"), /menuClass="flex w-\[18rem\] /);
		assert.equal(FONT_MENU_WIDTH, 18 * REM_PX);
	});

	it("the add-provider menu is w-72", () => {
		assert.match(repoFile("components/settings/keys-section.tsx"), /menuClass="flex w-72 /);
		assert.equal(KEYS_MENU_WIDTH, 72 * TAILWIND_SPACING_PX);
	});
});

describe("touchHitClass (G1)", () => {
	const PILL = "rounded-full px-2.5 py-1";

	it("adds the hit-box class on a touch phone", () => {
		assert.equal(cn(PILL, touchHitClass(true)), `${PILL} ${TOUCH_HIT_CLASS}`);
	});

	it("leaves desktop classes untouched", () => {
		assert.equal(cn(PILL, touchHitClass(false)), PILL);
	});

	it("the CSS hit box is TOUCH_HIT_HEIGHT square", () => {
		const body = repoFile("app/globals.css").match(/\.lh-touch-hit::after\s*\{([^}]*)\}/)?.[1];
		assert.ok(body, "globals.css defines .lh-touch-hit::after");
		assert.match(body, new RegExp(`width:\\s*max\\(100%,\\s*${TOUCH_HIT_HEIGHT}px\\)`));
		assert.match(body, new RegExp(`height:\\s*max\\(100%,\\s*${TOUCH_HIT_HEIGHT}px\\)`));
	});
});

describe("statsPopoverAlign (G2)", () => {
	it("a narrow browser anchors the popover to the control's leading edge", () => {
		assert.equal(statsPopoverAlign(true), "start");
	});

	it("desktop keeps it centred", () => {
		assert.equal(statsPopoverAlign(false), "center");
	});
});
