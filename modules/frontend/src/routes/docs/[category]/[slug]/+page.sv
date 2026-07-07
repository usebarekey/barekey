<script lang="ts" effect>
	import type { PageProps } from "./$types";
	import { GetPost } from "$/docs/[category]/[slug]/page.remote";
	import content_meta from "$content/meta.json";
	import DocsContent from "$/docs/[category]/[slug]/components/docs-content.sv";
	import DocsSidebar from "$/docs/[category]/[slug]/components/docs-sidebar.sv";
	import DocsPageFrame from "$/docs/[category]/[slug]/components/docs-page-frame.sv";
	import DocsTableOfContents from "$/docs/[category]/[slug]/components/docs-table-of-contents.sv";

	let { params }: PageProps = $props();

	const route = $derived({
		category: params.category,
		slug: params.slug,
	});
	const post = $derived(yield* GetPost(route));
</script>

<DocsPageFrame>
	{#snippet sidebar()}
		<DocsSidebar {content_meta} {route} />
	{/snippet}

	{#snippet article()}
		<DocsContent {content_meta} {post} {route} />
	{/snippet}

	{#snippet table_of_contents(article_viewport: HTMLElement | null)}
		<DocsTableOfContents entries={post.toc} {article_viewport} />
	{/snippet}
</DocsPageFrame>
