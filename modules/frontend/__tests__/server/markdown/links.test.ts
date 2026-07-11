import { expect, test } from "vitest";
import {
	get_markdown_link_properties,
	is_docs_markdown_href,
} from "$lib/server/markdown/mdsvex.ts";

test("keeps docs markdown links in the current tab", () => {
	expect(is_docs_markdown_href("/docs#overview")).toBe(true);
	expect(is_docs_markdown_href("/docs/ser/introduction")).toBe(true);
	expect(is_docs_markdown_href("../ser/installation")).toBe(true);
	expect(is_docs_markdown_href("#heading")).toBe(true);
});

test("opens non-doc markdown links in a new tab", () => {
	expect(is_docs_markdown_href("https://effect.website/")).toBe(false);
	expect(is_docs_markdown_href("https://svelte.dev/docs/kit")).toBe(false);
	expect(is_docs_markdown_href("mailto:support@example.com")).toBe(false);
	expect(is_docs_markdown_href("/")).toBe(false);
});

test("adds safe new-tab properties to non-doc markdown links", () => {
	expect(
		get_markdown_link_properties({
			href: "https://effect.website/",
			rel: ["nofollow"],
		}),
	).toEqual({
		href: "https://effect.website/",
		rel: ["nofollow", "noopener", "noreferrer", "external"],
		target: "_blank",
	});

	expect(
		get_markdown_link_properties({
			href: "/docs/ser/introduction",
		}),
	).toEqual({
		href: "/docs/ser/introduction",
	});
});
