<script lang="ts">
	import { capture_event } from "$lib/client/analytics";
	import type { PageProps } from "./$types";
	import content_meta from "$content/meta.json";
	import DocsContent from "$/docs/[category]/[slug]/components/docs-content.sv";
	import DocsSidebar from "$/docs/[category]/[slug]/components/docs-sidebar.sv";
	import DocsPageFrame from "$/docs/[category]/[slug]/components/docs-page-frame.sv";
	import DocsTableOfContents from "$/docs/[category]/[slug]/components/docs-table-of-contents.sv";

	let { data }: PageProps = $props();

	const route = $derived(data.route);
	const metadata = $derived(data.metadata);
	const canonical_url = $derived(`${data.origin}/docs/${route.category}/${route.slug}`);
	const og_image_url = $derived(`${data.origin}/og/docs/${route.category}/${route.slug}.png`);
	const image_alt = $derived(`${metadata.title} | Barekey`);
	const has_og_image = $derived(data.has_frontmatter);
	const article_heading = $derived({
		id: "docs-page-heading",
		title: data.title,
	});

	let tracked_docs_page = $state<string | null>(null);

	$effect(() => {
		const page_key = `${route.category}/${route.slug}`;

		if (tracked_docs_page === page_key) {
			return;
		}

		tracked_docs_page = page_key;
		capture_event("docs_page_viewed", {
			category: route.category,
			slug: route.slug,
			doc_title: metadata.title,
		});
	});
</script>

<svelte:head>
	<title>{metadata.title} | Barekey</title>
	<link rel="canonical" href={canonical_url} />
	<meta name="description" content={metadata.description} />
	<meta property="og:type" content="article" />
	<meta property="og:site_name" content="Barekey" />
	<meta property="og:title" content={metadata.title} />
	<meta property="og:description" content={metadata.description} />
	<meta property="og:url" content={canonical_url} />
	<meta name="twitter:title" content={metadata.title} />
	<meta name="twitter:description" content={metadata.description} />
	{#if has_og_image}
		<meta property="og:image" content={og_image_url} />
		<meta property="og:image:type" content="image/png" />
		<meta property="og:image:width" content="1200" />
		<meta property="og:image:height" content="630" />
		<meta property="og:image:alt" content={image_alt} />
		<meta name="twitter:card" content="summary_large_image" />
		<meta name="twitter:image" content={og_image_url} />
		<meta name="twitter:image:alt" content={image_alt} />
	{/if}
</svelte:head>

<DocsPageFrame page_key={`${route.category}/${route.slug}`}>
	{#snippet sidebar()}
		<DocsSidebar {content_meta} {route} />
	{/snippet}

	{#snippet article()}
		<DocsContent heading_id={article_heading.id} post={data} />
	{/snippet}

	{#snippet table_of_contents(article_viewport: HTMLElement | null)}
		<DocsTableOfContents entries={data.toc} header={article_heading} {article_viewport} />
	{/snippet}
</DocsPageFrame>
