<script lang="ts">
	import type { Component } from "svelte";
	import DocsArticle from "$/docs/[category]/[slug]/components/docs-article.sv";

	type DocsPost = {
		Content: Component;
		metadata: {
			title: string;
			description: string;
		};
		title: string;
	};

	let {
		heading_id,
		post,
	}: {
		heading_id: string;
		post: DocsPost;
	} = $props();

	const title = $derived(post.title);
	const description = $derived(post.metadata.description);
	const Content = $derived(post.Content);
</script>

<DocsArticle {description} {heading_id} {title}>
	<Content />
</DocsArticle>
