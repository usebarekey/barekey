import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

test("mobile media queries use valid parenthesized conditions", () => {
	const is_mobile_source = readFileSync("src/lib/hooks/is-mobile.svelte.ts", "utf8");

	expect(is_mobile_source).toContain("(max-width: ${breakpoint - 1}px)");
});
