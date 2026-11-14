import { enterKey } from "./phone-layout";

/**
 * The text fields' Enter chord, shared by the composer and every dock field
 * (question answer and thinking, practice, reading-thinking): one decision
 * instead of a hand-written `!shiftKey || metaKey || ctrlKey` per field.
 */

/** The parts of a (React or DOM) keydown the chord reads. */
export interface EnterKeyEvent {
	key: string;
	shiftKey: boolean;
	metaKey: boolean;
	ctrlKey: boolean;
	nativeEvent: Event;
}

/** Enters the app dispatched to submit a field. A WeakSet, so a marked
 *  event is recognised by identity and released with it — no flag on the
 *  event object that a stray typed Enter could carry. */
const explicitSubmits = new WeakSet<Event>();

/** Marks a dispatched Enter as a request to submit the field it lands in
 *  (the citation popover's Send). On a touch phone a typed Enter is a
 *  newline; this one must still submit. */
export function markExplicitSubmit<E extends Event>(event: E): E {
	explicitSubmits.add(event);
	return event;
}

/** True when this keydown should submit (or open) the field it lands in. */
export function isSubmitEnter(event: EnterKeyEvent, enterInsertsNewline: boolean): boolean {
	if (event.key !== "Enter") return false;
	const chord = {
		enterInsertsNewline,
		shiftKey: event.shiftKey,
		metaKey: event.metaKey,
		ctrlKey: event.ctrlKey,
		explicitSubmit: explicitSubmits.has(event.nativeEvent),
	};
	return enterKey(chord) === "submit";
}

/** The dock fields' Enter hint, matching what Enter actually does. */
const DESKTOP_ENTER_HINT = "↵ submits · ⇧↵ newline";
const NEWLINE_ENTER_HINT = "↵ newline";

export function enterHint(enterInsertsNewline: boolean): string {
	return enterInsertsNewline ? NEWLINE_ENTER_HINT : DESKTOP_ENTER_HINT;
}
