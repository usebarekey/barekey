export type DocsNavEntry = {
	name?: string;
	path: string;
};

export type DocsNavEntryGroupItem = Record<string, DocsNavEntry | undefined>;

export type DocsNavEntryGroup = {
	category?: string;
	collapsible?: boolean;
	entries: DocsNavEntryGroupItem[];
	name?: string;
};

export type DocsNavGroup = {
	entries: DocsNavEntryGroup[];
	title: string;
};

export type DocsContentMeta = Record<string, DocsNavGroup>;

export const get_docs_nav_entry_pairs = (entry_groups: DocsNavEntryGroup[]) =>
	entry_groups.flatMap((entry_group) =>
		entry_group.entries.flatMap((entry_group_item) =>
			Object.entries(entry_group_item).filter(
				(entry): entry is [string, DocsNavEntry] => entry[1] !== undefined,
			),
		),
	);
