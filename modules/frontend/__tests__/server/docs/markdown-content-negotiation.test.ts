import { expect, test } from "vitest";
import { readFile } from "node:fs/promises";
import type { RequestEvent } from "@sveltejs/kit";
import { Effect, Option } from "effect";
import {
	accepts_docs_markdown,
	HandleDocsMarkdownRequest,
	LoadDocsMarkdownResponse,
} from "$lib/server/docs/markdown-response";

const make_docs_event = (category: string, slug: string, accept = "text/markdown") =>
	({
		params: {
			category,
			slug,
		},
		request: new Request("https://barekey.dev/docs/ser/introduction", {
			headers: { accept },
		}),
		route: { id: "/docs/[category]/[slug]" },
	}) as RequestEvent;

test("serves a docs source file unchanged when Markdown is accepted", async () => {
	const expected_markdown = await readFile(
		new URL("../../../src/content/ser/introduction.mdx", import.meta.url),
		"utf8",
	);

	const response = await Effect.runPromise(
		LoadDocsMarkdownResponse({ category: "ser", slug: "introduction" }, { vary_accept: true }),
	);

	expect(Option.isSome(response)).toBe(true);
	if (Option.isSome(response)) {
		expect(response.value.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
		expect(response.value.headers.get("vary")).toBe("Accept");
		expect(await response.value.text()).toBe(expected_markdown);
	}
});

test("returns no response when a docs source is not configured", async () => {
	const response = await Effect.runPromise(
		LoadDocsMarkdownResponse({ category: "ser", slug: "missing" }),
	);

	expect(Option.isNone(response)).toBe(true);
});

test("intercepts requests that prefer Markdown with HTML as a fallback", async () => {
	const event = make_docs_event("ser", "introduction", "text/markdown, text/html;q=0.8");

	const response = await Effect.runPromise(HandleDocsMarkdownRequest(event));

	expect(Option.isSome(response)).toBe(true);
	if (Option.isSome(response)) {
		expect(response.value.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
	}
});

test("rejects endpoint requests that do not accept Markdown", () => {
	expect(accepts_docs_markdown("application/json")).toBe(false);
});

test("serves raw docs source from a browser-addressable Markdown URL", async () => {
	const expected_markdown = await readFile(
		new URL("../../../src/content/ser/introduction.mdx", import.meta.url),
		"utf8",
	);

	const response = await Effect.runPromise(
		LoadDocsMarkdownResponse({ category: "ser", slug: "introduction" }),
	);

	expect(Option.isSome(response)).toBe(true);
	if (Option.isSome(response)) {
		expect(response.value.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
		expect(await response.value.text()).toBe(expected_markdown);
	}
});
