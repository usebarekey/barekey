import { Effect } from "effect";
import { expect, test } from "vitest";
import { ParseCodeMeta } from "$lib/server/markdown/components/code-meta.ts";
import { HighlightCode } from "$lib/server/markdown/highlighting.ts";

const strip_html_tags = (html: string) => html.replace(/<[^>]*>/g, "");

test("code metadata parses diff as a bare tag", async () => {
	const meta = await Effect.runPromise(ParseCodeMeta('diff name="vite.config.ts" icon="svelte"'));

	expect(meta.diff).toBe(true);
	expect(meta.name).toBe("vite.config.ts");
	expect(meta.icon).toBe("svelte");
});

test("code metadata leaves diff disabled unless tagged", async () => {
	const meta = await Effect.runPromise(ParseCodeMeta('name="vite.config.ts" icon="svelte"'));

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

test("diff code marks contiguous line group positions", async () => {
	const html = await Effect.runPromise(
		HighlightCode({
			code: [
				"++ const first = 1;",
				"++ const second = 2;",
				"-- const old_first = 1;",
				"-- const old_second = 2;",
				"-- const old_third = 3;",
				"++ const last = 3;",
			].join("\n"),
			diff: true,
			language: "ts",
		}),
	);

	expect(html).toContain('data-diff-position="start"');
	expect(html).toContain('data-diff-position="middle"');
	expect(html).toContain('data-diff-position="end"');
	expect(html).toContain('data-diff-position="single"');
	expect(html).toContain('data-diff-next="longer"');
	expect(html).toContain('data-diff-previous="shorter"');
	expect(html).toContain('data-diff-next="shorter"');
	expect(html).toContain('data-diff-previous="longer"');
	expect(html).not.toContain('data-diff-lip="next-longer"');
	expect(html).not.toContain('data-diff-lip="previous-longer"');
	expect(html).not.toContain("--diff-next-inline-delta:");
	expect(html).not.toContain("--diff-previous-inline-delta:");
	expect(html).not.toContain("--diff-group-inline-size:");
});
