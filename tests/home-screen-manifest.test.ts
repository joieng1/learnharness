import { describe, it } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import manifest from "../app/manifest.ts";
import { HOME_SCREEN_NAME } from "../lib/app-identity.ts";

const REPO_ROOT = path.resolve(import.meta.dirname, "..");
/** iOS truncates home-screen names past about this many characters. */
const IOS_HOME_SCREEN_NAME_LIMIT = 12;
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Width and height from a PNG's IHDR chunk (bytes 16–23). */
function pngSize(file: string): { width: number; height: number } {
	const bytes = fs.readFileSync(file);
	assert.ok(bytes.subarray(0, PNG_SIGNATURE.length).equals(PNG_SIGNATURE), `${file} is a PNG`);
	return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

describe("home-screen manifest", () => {
	const result = manifest();

	it("launches standalone at the root under the short home-screen name", () => {
		assert.equal(result.display, "standalone");
		assert.equal(result.start_url, "/");
		assert.equal(result.name, HOME_SCREEN_NAME);
		assert.equal(result.short_name, HOME_SCREEN_NAME);
		assert.ok(HOME_SCREEN_NAME.length <= IOS_HOME_SCREEN_NAME_LIMIT);
	});

	it("every manifest icon exists in public/ at its declared size", () => {
		assert.ok(result.icons && result.icons.length > 0);
		for (const icon of result.icons) {
			const [width, height] = String(icon.sizes).split("x").map(Number);
			assert.deepEqual(pngSize(path.join(REPO_ROOT, "public", icon.src)), { width, height });
		}
	});

	it("the iPhone icon is 180px square", () => {
		assert.deepEqual(pngSize(path.join(REPO_ROOT, "app/apple-icon.png")), { width: 180, height: 180 });
	});
});
