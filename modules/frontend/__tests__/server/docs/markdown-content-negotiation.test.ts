import { expect, test } from "vitest";
import { readFile } from "node:fs/promises";
import type { RequestEvent } from "@sveltejs/kit";
import { GET } from "$/docs/[category]/[slug]/+server";
import { GET as get_markdown } from "$/docs/[category]/[slug].md/+server";
import { handle_docs_markdown_request } from "$lib/server/docs/markdown-response";

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
	const event = make_docs_event("ser", "introduction");
	const expected_markdown = await readFile(
		new URL("../../../src/content/ser/introduction.mdx", import.meta.url),
		"utf8",
	);

	const response = await GET(event);

	expect(response.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
	expect(response.headers.get("vary")).toBe("Accept");
	expect(await response.text()).toBe(expected_markdown);
});

test("returns not found when a docs source is not configured", async () => {
	const event = make_docs_event("ser", "missing");

	await expect(GET(event)).rejects.toMatchObject({ status: 404 });
});

test("intercepts requests that prefer Markdown with HTML as a fallback", async () => {
	const event = make_docs_event("ser", "introduction", "text/markdown, text/html;q=0.8");

	const response = await handle_docs_markdown_request(event);

	expect(response?.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
});

test("rejects endpoint requests that do not accept Markdown", async () => {
	const event = make_docs_event("ser", "introduction", "application/json");

	await expect(GET(event)).rejects.toMatchObject({ status: 406 });
});

test("serves raw docs source from a browser-addressable Markdown URL", async () => {
	const event = make_docs_event(
		"ser",
		"introduction",
		"text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
	);
	const expected_markdown = await readFile(
		new URL("../../../src/content/ser/introduction.mdx", import.meta.url),
		"utf8",
	);

	const response = await get_markdown(event);

	expect(response.headers.get("content-type")).toBe("text/markdown; charset=utf-8");
	expect(await response.text()).toBe(expected_markdown);
});
