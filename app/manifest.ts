import type { MetadataRoute } from "next";
import { APP_DESCRIPTION, HOME_SCREEN_NAME } from "@/lib/app-identity";

/** Manifest icons, rendered from build/icon-flat.svg onto the artwork's own
 *  background (rgb 20,20,20) so they are full-bleed: iOS and Android mask the
 *  corners themselves and would fill transparent corners with black. The
 *  180px iPhone icon is app/apple-icon.png (Next's file convention). */
const MANIFEST_ICONS: MetadataRoute.Manifest["icons"] = [
	{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
	{ src: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
];

/** "Add to Home Screen" opens LearnHarness standalone, without Safari's
 *  chrome. No theme/background colour: the theme is chosen per install at
 *  runtime, so a fixed colour here would be wrong for some themes. */
export default function manifest(): MetadataRoute.Manifest {
	return {
		name: HOME_SCREEN_NAME,
		short_name: HOME_SCREEN_NAME,
		description: APP_DESCRIPTION,
		start_url: "/",
		display: "standalone",
		icons: MANIFEST_ICONS,
	};
}
