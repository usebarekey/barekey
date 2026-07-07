import { Data, Effect } from "effect";
import { FileSystem } from "effect/FileSystem";
import { markdownToHtml, type MarkdownToHtmlResult } from "satteri";
import { notes } from "$lib/server/markdown/components/notes";
import { ParseFrontmatter } from "$lib/server/markdown/parser";
import {
	code_snippets,
	inline_code_highlighting,
} from "$lib/server/markdown/components/code-snippets";
import { heading_copy_links, read_toc, table_of_contents } from "$lib/server/markdown/toc";

/**
 * Error raised when markdown rendering fails.
 * @since 0.0.1
 */
export class InternalRendererError extends Data.TaggedError("InternalRendererError")<{
	message: string;
}> {}

const resolve_content_path = (path: string) =>
	path.startsWith("$content/") ? path.replace("$content/", "src/content/") : path;

/**
 * Reads and renders an MDX content file.
 * @param path Content file path.
 * @returns An Effect resolving to rendered HTML and parsed frontmatter.
 * @since 0.0.1
 */
export const Render = (path: string) =>
	Effect.gen(function* () {
		const fs = yield* FileSystem;
		const txt = yield* fs.readFileString(resolve_content_path(path));

		const { html, frontmatter, data } = yield* Effect.tryPromise<
			MarkdownToHtmlResult,
			InternalRendererError
		>({
			try: async () =>
				await markdownToHtml(txt, {
					features: {
						gfm: true,
						directive: true,
						frontmatter: true,
						math: false,
					},
					mdastPlugins: [table_of_contents, notes, code_snippets],
					hastPlugins: [inline_code_highlighting, heading_copy_links],
				}),
			catch: (error) =>
				new InternalRendererError({
					message: error instanceof Error ? error.message : "Unknown error.",
				}),
		});

		const parsed_frontmatter = yield* ParseFrontmatter(frontmatter);

		return {
			html,
			frontmatter: parsed_frontmatter,
			toc: read_toc(data),
		};
	});
