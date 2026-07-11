import content_meta from "$content/meta.json";
import { get_docs_nav_entry_pairs, type DocsContentMeta } from "$lib/data/docs-content-meta";

export type DocsRoute = {
	category: string;
	slug: string;
};

const docs_content_meta = content_meta as DocsContentMeta;

const raw_modules = import.meta.glob("/src/content/**/*.mdx", {
	import: "default",
	query: "?raw",
}) as Record<string, () => Promise<string>>;

const get_content_path = ({ category, slug }: DocsRoute) => {
	const entry = get_docs_nav_entry_pairs(docs_content_meta[category]?.entries ?? []).find(
		([entry_slug]) => entry_slug === slug,
	)?.[1];

	return entry ? `/src/content/${entry.path.replaceAll("\\", "/")}` : null;
};

export const load_docs_markdown_source = async (route: DocsRoute) => {
	const configured_content_path = get_content_path(route);
	const direct_content_path = `/src/content/${route.category}/${route.slug}.mdx`;
	const raw_loader = [configured_content_path, direct_content_path]
		.filter((content_path): content_path is string => content_path !== null)
		.map((content_path) => raw_modules[content_path])
		.find(Boolean);

	return raw_loader ? raw_loader() : null;
};
