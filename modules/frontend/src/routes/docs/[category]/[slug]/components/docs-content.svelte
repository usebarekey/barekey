<script lang="ts">
	import DocsArticle from "$/docs/[category]/[slug]/components/docs-article.svelte";

	type DocsRoute = {
		category: string;
		slug: string;
	};

	type DocsNavEntry = {
		displayName?: string;
		path: string;
	};

	type DocsNavEntryGroup = Record<string, DocsNavEntry | undefined>;

	type DocsContentMeta = Record<
		string,
		{
			title: string;
			entries: DocsNavEntryGroup[];
		}
	>;

	type DocsPost = {
		html: string;
		frontmatter: {
			title: string;
			description: string;
		} | null;
	};

	const fallback_display_name = (slug: string) =>
		slug
			.split("-")
			.filter(Boolean)
			.map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
			.join(" ");

	const get_page_title = (
		meta: DocsContentMeta,
		{ category, slug }: DocsRoute,
		current_post: DocsPost,
	) => {
		const nav_entry = meta[category]?.entries
			.flatMap((entry_group) =>
				Object.entries(entry_group).filter(
					(entry): entry is [string, DocsNavEntry] => entry[1] !== undefined,
				)
			)
			.find(([entry_slug]) => entry_slug === slug)?.[1];

		return (
			nav_entry?.displayName ??
			current_post.frontmatter?.title ??
			fallback_display_name(slug)
		);
	};

	let {
		content_meta,
		post,
		route,
	}: {
		content_meta: DocsContentMeta;
		post: DocsPost;
		route: DocsRoute;
	} = $props();

	const title = $derived(get_page_title(content_meta, route, post));
	const description = $derived(post.frontmatter?.description);
</script>

<DocsArticle {description} html={post.html} {title} />
