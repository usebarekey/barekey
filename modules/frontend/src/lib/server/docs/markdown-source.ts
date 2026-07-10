import content_meta from "$content/meta.json";

type DocsNavEntry = {
	path: string;
};

type DocsNavEntryItem = Record<string, DocsNavEntry | undefined>;

type DocsNavEntryGroup = {
	entries: DocsNavEntryItem[];
};

type DocsNavItem = DocsNavEntryItem | DocsNavEntryGroup;

type DocsContentMeta = Record<
	string,
	{
		entries: DocsNavItem[];
	}
>;

export type DocsRoute = {
	category: string;
	slug: string;
};

const docs_content_meta = content_meta as DocsContentMeta;

const raw_modules = import.meta.glob("/src/content/**/*.mdx", {
	import: "default",
	query: "?raw",
}) as Record<string, () => Promise<string>>;

const is_nav_entry_group = (item: DocsNavItem): item is DocsNavEntryGroup =>
	Array.isArray(item.entries);

const get_entry_pairs = (items: DocsNavItem[]) =>
	items.flatMap((item) =>
		is_nav_entry_group(item)
			? item.entries.flatMap((entry) => Object.entries(entry))
			: Object.entries(item),
	);

const get_content_path = ({ category, slug }: DocsRoute) => {
	const entry = get_entry_pairs(docs_content_meta[category]?.entries ?? []).find(
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
