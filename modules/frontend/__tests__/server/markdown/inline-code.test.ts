import { Effect } from "effect";
import { expect, test } from "vitest";
import { parse_inline_code_language_spec } from "../../../src/lib/server/markdown/components/code-meta.ts";
import { HighlightInlineCode } from "../../../src/lib/server/markdown/highlighting.ts";

test("inline code language spec parses an explicit leading language", () => {
	expect(parse_inline_code_language_spec("ts fn()")?.language).toBe("ts");
	expect(parse_inline_code_language_spec("ts fn()")?.code).toBe("fn()");
});

test("inline code language spec defaults to no language", () => {
	expect(parse_inline_code_language_spec("fn()")).toBeNull();
});

test("highlights inline code through Shiki without block chrome", async () => {
	const html = await Effect.runPromise(
		HighlightInlineCode({
			code: "fn()",
			language: "ts",
		}),
	);

	expect(html).not.toContain("<pre");
	expect(html).toContain("--shiki-light:");
	expect(html).toContain("fn");
});
