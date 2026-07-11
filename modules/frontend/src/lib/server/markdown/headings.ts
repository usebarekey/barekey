import { Effect, Schema } from "effect";

const TableOfContentsEntrySchema = Schema.Struct({
	id: Schema.String,
	title: Schema.String,
	depth: Schema.Number,
});

/** Heading entry exposed to the page-level table of contents. */
export type TableOfContentsEntry = Schema.Schema.Type<typeof TableOfContentsEntrySchema>;

export const is_table_of_contents_entry = Schema.is(TableOfContentsEntrySchema);

const combining_mark_pattern = /[\u0300-\u036f]/g;
const unsafe_heading_id_character_pattern = /[^a-z0-9\s-]/g;
const repeated_dash_pattern = /-+/g;
const edge_dash_pattern = /^-|-$/g;
const fenced_code_pattern = /^([`~]{3,})/;
const frontmatter_fence_pattern = /^---\s*$/;
const atx_heading_pattern = /^(#{2,6})[ \t]+(.+?)[ \t]*#*[ \t]*$/;

const slug_heading = (title: string) =>
	title
		.trim()
		.toLowerCase()
		.normalize("NFKD")
		.replace(combining_mark_pattern, "")
		.replace(unsafe_heading_id_character_pattern, "")
		.replace(/\s+/g, "-")
		.replace(repeated_dash_pattern, "-")
		.replace(edge_dash_pattern, "") || "section";

/** Creates a stable heading id, suffixing duplicates within a document. */
export const create_heading_id = (title: string, used_heading_ids: Map<string, number>) => {
	const base_id = slug_heading(title);
	const used_count = used_heading_ids.get(base_id) ?? 0;

	used_heading_ids.set(base_id, used_count + 1);

	return used_count === 0 ? base_id : `${base_id}-${used_count + 1}`;
};

const strip_markdown_inline = (value: string) =>
	value
		.replace(/`([^`]+)`/g, "$1")
		.replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
		.replace(/[*_~]+/g, "")
		.replace(/<[^>]+>/g, "")
		.trim();

/** Extracts the table of contents from Markdown source using the same slugger as mdsvex. */
export const ExtractTableOfContents = (markdown: string) =>
	Effect.sync(() => {
		const entries: TableOfContentsEntry[] = [];
		const used_heading_ids = new Map<string, number>();
		const lines = markdown.replace(/\r\n?/g, "\n").split("\n");
		let in_frontmatter = lines[0] ? frontmatter_fence_pattern.test(lines[0]) : false;
		let fence: string | undefined;

		for (let index = in_frontmatter ? 1 : 0; index < lines.length; index++) {
			const line = lines[index]!;

			if (in_frontmatter) {
				if (frontmatter_fence_pattern.test(line)) {
					in_frontmatter = false;
				}

				continue;
			}

			const fence_match = line.match(fenced_code_pattern);

			if (fence_match) {
				if (!fence) {
					fence = fence_match[1][0]!;
				} else if (fence === fence_match[1][0]) {
					fence = undefined;
				}

				continue;
			}

			if (fence) {
				continue;
			}

			const heading_match = line.match(atx_heading_pattern);

			if (!heading_match) {
				continue;
			}

			const title = strip_markdown_inline(heading_match[2]);

			if (!title) {
				continue;
			}

			entries.push({
				depth: heading_match[1].length,
				id: create_heading_id(title, used_heading_ids),
				title,
			});
		}

		return entries;
	});
