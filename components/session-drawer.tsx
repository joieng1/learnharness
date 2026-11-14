"use client";

import { useLayoutEffect, useRef, type RefObject } from "react";
import { useInteractionLayer, useInteractionLayers } from "@/components/interaction-layers";

/**
 * The phone session drawer as a modal interaction layer (port decision D3):
 * while it floats over the page, Escape closes it (the layer owns the key,
 * so it never also aborts a turn), the covered page stops receiving global
 * shortcuts, and focus returns to whatever opened it — the hamburger — on
 * close. Desktop never registers it: the inline sidebar stays a non-modal
 * panel, exactly as today.
 *
 * Initial focus lands on the drawer itself, never on its search field: a
 * focused field would raise the phone keyboard over the list.
 */
export function useSessionDrawerLayer({
	open,
	rootRef,
	portalRef,
	onDismiss,
}: {
	/** True only while the overlay drawer is showing. */
	open: boolean;
	/** The drawer panel; it must accept programmatic focus (tabIndex -1). */
	rootRef: RefObject<HTMLElement | null>;
	/** A popup host OUTSIDE the drawer's transformed panel: a transform makes
	 *  the panel the containing block for fixed descendants, which would
	 *  misplace the row menus anchored inside it. */
	portalRef: RefObject<HTMLElement | null>;
	onDismiss: () => void;
}) {
	const controller = useInteractionLayers();
	const openerRef = useRef<HTMLElement | null>(null);
	const focusDrawer = () => rootRef.current?.focus({ preventScroll: true });
	// Registered before the focus effect below, so its cleanup (unregister)
	// runs first and the restore sees the post-close generation — the same
	// ordering HostDialog relies on.
	useInteractionLayer({
		kind: "modal",
		enabled: open,
		rootRef,
		portalRef,
		focusInitial: focusDrawer,
		onClose: () => {
			onDismiss();
			return "closed";
		},
	});
	useLayoutEffect(() => {
		if (!open) return;
		const active = document.activeElement;
		openerRef.current = active instanceof HTMLElement ? active : null;
		rootRef.current?.focus({ preventScroll: true });
		return () => {
			const generation = controller.getGeneration();
			const focusRevision = controller.getFocusRevision();
			const opener = openerRef.current;
			// After the close commits, so the opener is interactive again.
			setTimeout(() => {
				controller.restoreFocus(opener, generation, focusRevision);
			}, 0);
		};
	}, [open, controller, rootRef]);
}
