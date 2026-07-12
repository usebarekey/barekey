import { readFileSync } from "node:fs";
import { render } from "svelte/server";
import { expect, test } from "vitest";

import CodeSnippet from "$lib/components/markdown/code-snippet.sv";
import InlineCodeIcon from "$lib/components/markdown/inline-code-icon.sv";

const code_snippet_styles = readFileSync(
	"src/lib/styles/markdown/components/code-snippet.css",
	"utf8",
);

test("filename-less code snippets omit the header and overlay the copy control", () => {
	const { body } = render(CodeSnippet, {
		props: {
			code: "<pre><code>const answer = 42;</code></pre>",
		},
	});

	expect(body).not.toContain("docs-code-snippet-header");
	expect(body).toContain("docs-code-snippet-copy-overlay");
});

test("a link alone does not create an empty code snippet header", () => {
	const { body } = render(CodeSnippet, {
		props: {
			code: "<pre><code>const answer = 42;</code></pre>",
			link: "https://github.com/example/repo/blob/main/answer.ts#L1",
		},
	});

	expect(body).not.toContain("docs-code-snippet-header");
	expect(body).toContain("docs-code-snippet-copy-overlay");
});

test("named code snippets keep the filename header", () => {
	const { body } = render(CodeSnippet, {
		props: {
			code: "<pre><code>const answer = 42;</code></pre>",
			name: "answer.ts",
		},
	});

	expect(body).toContain("docs-code-snippet-header");
	expect(body).not.toContain("docs-code-snippet-copy-overlay");
});

test("code snippets use a smaller copy glyph without shrinking its button", () => {
	const { body } = render(CodeSnippet, {
		props: {
			code: "<pre><code>const answer = 42;</code></pre>",
		},
	});

	expect(body).toContain("size-3.5");
	expect(body).toContain("relative grid size-4 place-items-center");
	expect(body).toContain("flex size-4 items-center justify-center");
});

test("code snippet filenames share the copy button surface without changing shape", () => {
	const filename_rule = code_snippet_styles.match(
		/\.docs-code-snippet-filename \{[\s\S]*?\n\}/,
	)?.[0];

	expect(filename_rule).toContain("rounded-3xl");
	expect(filename_rule).toContain("bg-linear-to-b");
	expect(filename_rule).toContain("from-foreground/7.5 to-foreground/2.5");
	expect(filename_rule).toContain("card-lg");
});

test("source snippets render linked line and character metadata", () => {
	const { body } = render(CodeSnippet, {
		props: {
			char: 17,
			code: "<pre><code>const answer = 42;</code></pre>",
			line: 100,
			link: "https://github.com/example/repo/blob/main/answer.ts#L100",
			name: "answer.ts",
		},
	});

	expect(body).toContain("docs-source-location-name");
	expect(body).toContain("docs-source-location-position");
	expect(body).toContain("answer.ts");
	expect(body).toContain("L100");
	expect(body).toContain(" @ ");
	expect(body).toContain("C17");
	expect(body).toContain('href="https://github.com/example/repo/blob/main/answer.ts#L100"');
});

test("source snippets preserve zero and partial coordinates", () => {
	const line_only = render(CodeSnippet, {
		props: {
			code: "<pre><code>line</code></pre>",
			line: 0,
			name: "line.ts",
		},
	}).body;
	const char_only = render(CodeSnippet, {
		props: {
			char: 0,
			code: "<pre><code>char</code></pre>",
			name: "char.ts",
		},
	}).body;

	expect(line_only).toContain("L0");
	expect(line_only).not.toContain(" @ ");
	expect(char_only).toContain("C0");
	expect(char_only).not.toContain(" @ ");
});

test("inline source locations render a linked source label", () => {
	const { body } = render(InlineCodeIcon, {
		props: {
			char: 8,
			line: 12,
			link: "https://github.com/example/repo/blob/main/src/example.ts#L12",
			name: "src/example.ts",
		},
	});

	expect(body).toContain("src/example.ts");
	expect(body).toContain("L12");
	expect(body).toContain(" @ ");
	expect(body).toContain("C8");
	expect(body).toContain('href="https://github.com/example/repo/blob/main/src/example.ts#L12"');
});
