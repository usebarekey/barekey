import { Effect } from "effect";
import { expect, test } from "vitest";
import { parse_code_meta } from "../src/lib/server/markdown/components/code-meta.ts";
import { HighlightCode } from "../src/lib/server/markdown/highlighting.ts";

const strip_html_tags = (html: string) => html.replace(/<[^>]*>/g, "");

test("code metadata parses diff as a bare tag", () => {
	const meta = parse_code_meta('diff name="vite.config.ts" icon="svelte"');

	expect(meta.diff).toBe(true);
	expect(meta.name).toBe("vite.config.ts");
	expect(meta.icon).toBe("svelte");
});

test("code metadata leaves diff disabled unless tagged", () => {
	const meta = parse_code_meta('name="vite.config.ts" icon="svelte"');

	expect(meta.diff).toBe(false);
});

test("diff code strips markers and uses Shiki diff colors", async () => {
	const html = await Effect.runPromise(
		HighlightCode({
			code: '++ import { effect } from "svelte-effect-runtime";\n--    effect(),',
			diff: true,
			language: "ts",
		}),
	);
	const text = strip_html_tags(html);

	expect(text).not.toContain("++");
	expect(text).not.toContain("--");
	expect(text).toContain('import { effect } from "svelte-effect-runtime";');
	expect(text).toContain("    effect(),");
	expect(html).toContain('data-diff="inserted"');
	expect(html).toContain('data-diff="deleted"');
	expect(html).not.toContain("--shiki-diff-dark:");
	expect(html).toContain("--shiki-diff-light:");
});
