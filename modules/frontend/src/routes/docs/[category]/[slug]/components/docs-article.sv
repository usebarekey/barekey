<script lang="ts">
	let {
		description,
		html,
		title,
	}: {
		description: string | undefined;
		html: string;
		title: string;
	} = $props();
</script>

<div
	class="docs-prose-media-scope flex min-h-full flex-col gap-6 p-7"
	data-prose-media-scope
>
	<div class="flex max-w-[60ch] flex-col gap-2">
		<h1 class="font-heading text-3xl font-semibold">{title}</h1>
		{#if description}
			<span class="font-medium text-muted-foreground">{description}</span>
		{/if}
	</div>

	<div class="docs-prose-divider h-px bg-foreground/10"></div>

	<div class="prose max-w-none font-medium">
		{@html html}
	</div>
</div>
