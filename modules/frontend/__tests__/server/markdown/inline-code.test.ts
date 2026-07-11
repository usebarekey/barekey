import { Effect, Option } from "effect";
import { compile } from "mdsvex";
import { expect, test } from "vitest";
import {
	parse_inline_code_icon_spec,
	parse_inline_code_language_spec,
} from "$lib/server/markdown/components/code-meta.ts";
import { HighlightInlineCode } from "$lib/server/markdown/highlighting.ts";
import { markdown_mdsvex_options } from "$lib/server/markdown/mdsvex.ts";

test("inline code language spec parses an explicit leading language", () => {
	expect(parse_inline_code_language_spec("ts fn()")).toEqual(
		Option.some({
			code: "fn()",
			language: "ts",
		}),
	);
});

test("inline code language spec defaults to no language", () => {
	expect(Option.isNone(parse_inline_code_language_spec("fn()"))).toBe(true);
});

test("inline code language spec ignores prose that starts with an unknown word", () => {
	expect(Option.isNone(parse_inline_code_language_spec("inline code"))).toBe(true);
	expect(Option.isNone(parse_inline_code_language_spec("const value = 1"))).toBe(true);
});

test("inline code icon spec parses leading icon metadata", () => {
	expect(parse_inline_code_icon_spec('icon="vite" vite.config.ts')).toEqual(
		Option.some({
			icon: "vite",
			name: "vite.config.ts",
			text: "vite.config.ts",
		}),
	);
	expect(parse_inline_code_icon_spec("icon=vite vite.config.ts")).toEqual(
		Option.some({
			icon: "vite",
			name: "vite.config.ts",
			text: "vite.config.ts",
		}),
	);
});

test("inline source metadata parses coordinates and a link", () => {
	expect(
		parse_inline_code_icon_spec(
			'icon="ts" name="src/example.ts" line="12" char="8" link="https://github.com/example/repo/blob/main/src/example.ts#L12" src/example.ts',
		),
	).toEqual(
		Option.some({
			char: 8,
			icon: "ts",
			line: 12,
			link: "https://github.com/example/repo/blob/main/src/example.ts#L12",
			name: "src/example.ts",
			text: "src/example.ts",
		}),
	);
});

test("inline source metadata accepts attributes without duplicate trailing text", () => {
	expect(
		parse_inline_code_icon_spec(
			'name="src/example.ts" line="12" char="8" link="https://github.com/example/repo/blob/main/src/example.ts#L12"',
		),
	).toEqual(
		Option.some({
			char: 8,
			line: 12,
			link: "https://github.com/example/repo/blob/main/src/example.ts#L12",
			name: "src/example.ts",
			text: "src/example.ts",
		}),
	);
});

test("inline code icon spec leaves normal inline code alone", () => {
	expect(Option.isNone(parse_inline_code_icon_spec("vite.config.ts"))).toBe(true);
	expect(Option.isNone(parse_inline_code_icon_spec("ts effect()"))).toBe(true);
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

test("highlights a bare SER yield expression as control flow", async () => {
	const html = await Effect.runPromise(
		HighlightInlineCode({
			code: "yield*",
			language: "ser",
		}),
	);

	expect(html).toContain("--shiki-light:#D73A49");
	expect(html).toContain("--shiki-dark:#F97583");
});

test("keeps inline SER event attributes in the markup grammar", async () => {
	const html = await Effect.runPromise(
		HighlightInlineCode({
			code: "<button onclick={yield* SaveProfile()}>",
			language: "ser",
		}),
	);

	expect(html).toContain("--shiki-light:#22863A");
	expect(html).toContain("--shiki-light:#D73A49");
});

test("compiles generic inline code without rendering escaped brackets", async () => {
	const compiled = await compile("`ts Effect.Effect<A, E, R>`", {
		...markdown_mdsvex_options,
		filename: "inline-code.mdx",
	});
	const code = compiled?.code ?? "";

	expect(code).toContain('"content":"<"');
	expect(code).toContain('"content":">"');
	expect(code).not.toContain("&lt;");
	expect(code).not.toContain("&gt;");
});

test("compiles inline declaration tags without rendering escaped braces", async () => {
	const compiled = await compile("`svelte {@const value = 1}`", {
		...markdown_mdsvex_options,
		filename: "inline-declaration.mdx",
	});
	const code = compiled?.code ?? "";

	expect(code).toContain('"content":"{@"');
	expect(code).toContain('"content":"}"');
	expect(code).not.toContain("&#123;");
	expect(code).not.toContain("&#125;");
});
