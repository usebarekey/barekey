<script lang="ts">
	import type { Snippet } from "svelte";

	let {
		children,
		description,
		heading_id,
		title,
	}: {
		children: Snippet;
		description: string | undefined;
		heading_id: string;
		title: string;
	} = $props();
</script>

<div
	class="docs-prose-media-scope flex min-h-full flex-col gap-6 p-5 sm:p-6 xl:p-7"
	data-prose-media-scope
>
	<div class="flex max-w-[60ch] flex-col gap-2">
		<h1 id={heading_id} class="font-heading text-3xl font-semibold">
			<a class="docs-heading-self-link" href={`#${heading_id}`}>{title}</a>
		</h1>
		{#if description}
			<span class="font-medium text-muted-foreground">{description}</span>
		{/if}
	</div>

	<div class="docs-prose-divider h-px bg-foreground/10"></div>

	<div class="prose max-w-none font-medium">
		{@render children()}
	</div>
</div>
