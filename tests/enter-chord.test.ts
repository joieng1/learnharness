/**
 * The text fields' Enter chord. Port decision D2 makes Enter type a newline
 * on a touch phone — but the citation popover's Send submits a dock field by
 * dispatching a synthetic Enter into it (chat.tsx), so that one Enter must
 * stay a submit whatever the layout says.
 */
import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isSubmitEnter, markExplicitSubmit, type EnterKeyEvent } from "../components/enter-chord.ts";

function keydown(modifiers: Partial<Pick<EnterKeyEvent, "shiftKey" | "metaKey" | "ctrlKey">> = {}, nativeEvent = new Event("keydown")): EnterKeyEvent {
	return { key: "Enter", shiftKey: false, metaKey: false, ctrlKey: false, nativeEvent, ...modifiers };
}

describe("isSubmitEnter", () => {
	it("desktop: Enter submits, Shift+Enter is a newline, ⌘/Ctrl+Enter submits", () => {
		assert.equal(isSubmitEnter(keydown(), false), true);
		assert.equal(isSubmitEnter(keydown({ shiftKey: true }), false), false);
		assert.equal(isSubmitEnter(keydown({ shiftKey: true, metaKey: true }), false), true);
		assert.equal(isSubmitEnter(keydown({ ctrlKey: true }), false), true);
	});

	it("touch phone: a typed Enter is a newline, ⌘/Ctrl+Enter still submits", () => {
		assert.equal(isSubmitEnter(keydown(), true), false);
		assert.equal(isSubmitEnter(keydown({ metaKey: true }), true), true);
	});

	it("only Enter is ever a submit", () => {
		assert.equal(isSubmitEnter({ ...keydown(), key: "a" }, false), false);
	});

	it("citation Send: a marked Enter submits even where Enter types newlines", () => {
		const sent = keydown({}, markExplicitSubmit(new Event("keydown")));
		assert.equal(isSubmitEnter(sent, true), true);
		assert.equal(isSubmitEnter(sent, false), true);
	});

	it("marking one event does not turn other Enters into submits", () => {
		markExplicitSubmit(new Event("keydown"));
		assert.equal(isSubmitEnter(keydown(), true), false);
	});
});
