import { Effect } from "effect";
import content_meta from "$content/meta.json";
import { get_docs_nav_entry_pairs, type DocsContentMeta } from "$lib/data/docs-content-meta";
import { ExtractTableOfContents, type TableOfContentsEntry } from "$lib/server/markdown/headings";
import { DecodeFrontmatter, type ParsedFrontmatter } from "$lib/server/markdown/parser";

export type DocsRoute = {
	category: string;
	slug: string;
};

export type DocsContent = {
	content_path: string;
	has_frontmatter: boolean;
	markdown: string;
	metadata: ParsedFrontmatter;
	route: DocsRoute;
	title: string;
	toc: TableOfContentsEntry[];
};

const docs_content_meta = content_meta as DocsContentMeta;

const metadata_modules = import.meta.glob("/src/content/**/*.mdx", {
	import: "metadata",
}) as Record<string, () => Promise<unknown>>;

const raw_modules = import.meta.glob("/src/content/**/*.mdx", {
	import: "default",
	query: "?raw",
}) as Record<string, () => Promise<string>>;

const fallback_name = (slug: string) =>
	slug
		.split("-")
		.filter(Boolean)
		.map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
		.join(" ");

const get_content_entry = ({ category, slug }: DocsRoute) =>
	get_docs_nav_entry_pairs(docs_content_meta[category]?.entries ?? []).find(
		([entry_slug]) => entry_slug === slug,
	)?.[1];

const get_content_path = (path: string) => `/src/content/${path.replaceAll("\\", "/")}`;

const has_frontmatter_metadata = (metadata: unknown) =>
	typeof metadata === "object" &&
	metadata !== null &&
	!Array.isArray(metadata) &&
	Object.keys(metadata).length > 0;

const decode_metadata = (metadata: unknown, fallback: ParsedFrontmatter) =>
	has_frontmatter_metadata(metadata) ? DecodeFrontmatter(metadata) : Effect.succeed(fallback);

export const get_docs_entries = () =>
	Object.entries(docs_content_meta).flatMap(([category, group]) =>
		get_docs_nav_entry_pairs(group.entries).map(([slug]) => ({
			category,
			slug,
		})),
	);

export const get_docs_categories = () => Object.keys(docs_content_meta);

export const get_first_slug_for_category = (category: string): string | null => {
	const group = docs_content_meta[category];
	if (!group?.entries) return null;
	const pairs = get_docs_nav_entry_pairs(group.entries);
	return pairs[0]?.[0] ?? null;
};

export const load_docs_content = async (route: DocsRoute) => {
	const entry = get_content_entry(route);

	if (!entry) {
		return null;
	}

	const content_path = get_content_path(entry.path);
	const metadata_loader = metadata_modules[content_path];
	const raw_loader = raw_modules[content_path];

	if (!metadata_loader || !raw_loader) {
		return null;
	}

	const [metadata, markdown] = await Promise.all([metadata_loader(), raw_loader()]);
	const has_frontmatter = has_frontmatter_metadata(metadata);
	const decoded_metadata = await Effect.runPromise(
		decode_metadata(has_frontmatter ? metadata : undefined, {
			description: "",
			title: entry.name ?? fallback_name(route.slug),
		}),
	);

	return {
		content_path,
		has_frontmatter,
		markdown,
		metadata: decoded_metadata,
		route,
		title: entry.name ?? decoded_metadata.title,
		toc: Effect.runSync(ExtractTableOfContents(markdown)),
	};
};
