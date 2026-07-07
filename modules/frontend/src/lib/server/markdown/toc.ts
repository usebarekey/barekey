import { Schema } from "effect";
import { type Data, defineHastPlugin, defineMdastPlugin } from "satteri";
import { render_copy_button } from "$lib/server/markdown/components/copy-button";

const table_of_contents_entry_schema = Schema.Struct({
	id: Schema.String,
	title: Schema.String,
	depth: Schema.Number,
});

/**
 * A heading entry exposed to the page-level table of contents.
 * @since 0.0.1
 */
export type TableOfContentsEntry = Schema.Schema.Type<typeof table_of_contents_entry_schema>;

declare module "satteri" {
	interface DataMap {
		toc: TableOfContentsEntry[];
	}
}

const combining_mark_pattern = /[\u0300-\u036f]/g;
const unsafe_heading_id_character_pattern = /[^a-z0-9\s-]/g;
const repeated_dash_pattern = /-+/g;
const edge_dash_pattern = /^-|-$/g;

const is_record = (value: unknown): value is Record<string, unknown> =>
	typeof value === "object" && value !== null && !Array.isArray(value);

const is_table_of_contents_entry = Schema.is(table_of_contents_entry_schema);

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

const create_heading_id = (title: string, used_heading_ids: Map<string, number>) => {
	const base_id = slug_heading(title);
	const used_count = used_heading_ids.get(base_id) ?? 0;

	used_heading_ids.set(base_id, used_count + 1);

	return used_count === 0 ? base_id : `${base_id}-${used_count + 1}`;
};

const set_heading_id = (node: Readonly<{ data?: unknown }>, id: string) => {
	const data = is_record(node.data) ? node.data : {};
	const h_properties = is_record(data.hProperties) ? data.hProperties : {};

	return {
		...data,
		hProperties: {
			...h_properties,
			id,
		},
	};
};

const get_hast_id = (properties: unknown) => {
	if (!is_record(properties)) {
		return undefined;
	}

	return typeof properties.id === "string" && properties.id ? properties.id : undefined;
};

/**
 * Creates a per-document Satteri plugin that assigns heading ids and records
 * the generated table of contents entries.
 * @since 0.0.1
 */
export const table_of_contents = () => {
	const entries: TableOfContentsEntry[] = [];
	const used_heading_ids = new Map<string, number>();

	return defineMdastPlugin({
		name: "table-of-contents",
		heading(node, ctx) {
			if (node.depth < 2) {
				return;
			}

			const title = ctx.textContent(node).trim();

			if (!title) {
				return;
			}

			const id = create_heading_id(title, used_heading_ids);

			entries.push({
				id,
				title,
				depth: node.depth,
			});

			ctx.setProperty(node, "data", set_heading_id(node, id));
			ctx.data.toc = entries;
		},
	});
};

/**
 * Adds hover-revealed copy buttons to rendered Markdown headings.
 * @since 0.0.1
 */
export const heading_copy_links = defineHastPlugin({
	name: "heading-copy-links",
	element: {
		filter: ["h2", "h3", "h4", "h5", "h6"],
		visit(node, ctx) {
			const id = get_hast_id(node.properties);

			if (!id) {
				return;
			}

			ctx.appendChild(node, {
				type: "raw",
				value: render_copy_button({
					attributes: {
						"data-copy-kind": "heading-link",
						"data-heading-id": id,
					},
					class_name: "docs-heading-copy not-prose",
					feedback_text: "Copied link.",
					label: "Copy link",
				}),
			});
		},
	},
});

/**
 * Reads the table of contents collected by the Satteri plugin.
 * @param data Document-level data returned by Satteri.
 * @returns Valid table of contents entries.
 * @since 0.0.1
 */
export const read_toc = (data: Data) =>
	Array.isArray(data.toc) ? data.toc.filter(is_table_of_contents_entry) : [];
