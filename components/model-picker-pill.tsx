"use client";

import type { ComponentProps } from "react";
import { touchHitClass } from "@/components/phone-layout";
import { usePhoneLayout } from "@/components/phone-layout-context";
import { cn } from "@/lib/utils";

/** The core and controlled plugin pickers share the very same trigger renderer. */
export function ModelPickerPill({ children, ...props }: ComponentProps<"button">) {
	const { touchPhone } = usePhoneLayout();
	return <button type="button" {...props}
		className={cn(
			"flex items-center gap-1.5 rounded-full border bg-card/85 px-2.5 py-1 font-ui text-xs shadow-lg backdrop-blur transition-colors hover:border-border hover:bg-muted",
			touchHitClass(touchPhone),
		)}>
		<span className="text-card-foreground">{children}</span>
		<span aria-hidden className="text-xs text-muted-foreground">▾</span>
	</button>;
}
