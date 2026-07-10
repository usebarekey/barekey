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

type DocsRoute = {
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
	const content_path = get_content_path(route);
	const raw_loader = content_path ? raw_modules[content_path] : undefined;

	return raw_loader ? raw_loader() : null;
};
