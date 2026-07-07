import { Data, Effect } from "effect";
import { escape } from "html-escaper";
import { defineMdastPlugin, markdownToHtml } from "satteri";
import { render } from "svelte/server";
import {
	code_snippets,
	inline_code_highlighting,
} from "$lib/server/markdown/components/code-snippets";
import {
	type NoteVariant,
	parse_note_markdown,
	type ParsedNote,
	strip_blockquote_markers,
} from "$lib/server/markdown/components/note-meta";
import AlertTriangle from "@tabler/icons-svelte/icons/alert-triangle";
import Bulb from "@tabler/icons-svelte/icons/bulb";
import InfoCircle from "@tabler/icons-svelte/icons/info-circle";

const note_variant_icons = {
	info: InfoCircle,
	tip: Bulb,
	warning: AlertTriangle,
};

/**
 * Error raised when nested note markdown cannot be rendered.
 * @since 0.0.1
 */
export class NoteMarkdownRenderError extends Data.TaggedError("NoteMarkdownRenderError")<{
	message: string;
}> {}

/**
 * Error raised when a note component cannot be server-rendered.
 * @since 0.0.1
 */
export class NoteComponentRenderError extends Data.TaggedError("NoteComponentRenderError")<{
	message: string;
}> {}

const RenderMarkdown = (markdown: string) =>
	markdown
		? Effect.tryPromise({
				try: async () =>
					(
						await markdownToHtml(markdown, {
							features: {
								gfm: true,
								math: false,
							},
							mdastPlugins: [code_snippets],
							hastPlugins: [inline_code_highlighting],
						})
					).html.trim(),
				catch: (error) =>
					new NoteMarkdownRenderError({
						message: error instanceof Error ? error.message : "Unknown error.",
					}),
			})
		: Effect.succeed("");

const RenderInlineMarkdown = (markdown: string) =>
	Effect.gen(function* () {
		const html = yield* RenderMarkdown(markdown);
		const paragraph_match = html.match(/^<p>([\s\S]*)<\/p>$/);

		return paragraph_match?.[1] ?? html;
	});

const RenderNoteIcon = (variant: NoteVariant) =>
	Effect.try({
		try: () =>
			render(note_variant_icons[variant], {
				props: {
					"aria-hidden": true,
					class: "docs-note-icon",
					size: 20,
				},
			}).body,
		catch: (error) =>
			new NoteComponentRenderError({
				message: error instanceof Error ? error.message : "Unknown error.",
			}),
	});

const RenderNote = ({ body, title, variant }: ParsedNote) =>
	Effect.gen(function* () {
		const body_html = yield* RenderMarkdown(body);
		const title_html = yield* RenderInlineMarkdown(title);
		const icon_html = yield* RenderNoteIcon(variant);
		const body_section = body_html ? `<div class="docs-note-body">${body_html}</div>` : "";

		return `<aside class="docs-note not-prose" data-note-variant="${escape(
			variant,
		)}"><div class="docs-note-header">${icon_html}<div class="docs-note-title">${title_html}</div></div>${body_section}</aside>`;
	});

const read_source_slice = (
	node: Readonly<{ position?: { start?: { offset?: number }; end?: { offset?: number } } }>,
	source: string,
) => {
	const start = node.position?.start?.offset;
	const end = node.position?.end?.offset;

	return typeof start === "number" && typeof end === "number"
		? source.slice(start, end)
		: undefined;
};

const merge_notes_group_data = (data: unknown) => ({
	...(typeof data === "object" && data !== null && !Array.isArray(data) ? data : {}),
	hName: "div",
	hProperties: {
		className: ["docs-note-group"],
	},
});

/**
 * Satteri plugin that renders GitHub-style note blockquotes and notes groups.
 * @since 0.0.1
 */
export const notes = defineMdastPlugin({
	name: "notes",
	blockquote(node, ctx) {
		const raw_source = read_source_slice(node, ctx.source);
		const markdown = raw_source ? strip_blockquote_markers(raw_source) : ctx.textContent(node);
		const note = parse_note_markdown(markdown);

		if (!note) {
			return;
		}

		return Effect.runPromise(
			RenderNote(note).pipe(
				Effect.map((html) =>
					ctx.replaceNode(node, {
						rawHtml: html,
					}),
				),
			),
		);
	},
	containerDirective(node, ctx) {
		if (node.name !== "notes") {
			return;
		}

		ctx.setProperty(node, "data", merge_notes_group_data(node.data));
	},
});
