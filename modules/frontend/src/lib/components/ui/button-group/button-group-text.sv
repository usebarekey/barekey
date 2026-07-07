<script lang="ts">
	import { cn, type WithElementRef } from "$lib/utils";
	import type { HTMLAttributes } from "svelte/elements";
	import type { Snippet } from "svelte";

	let {
		ref = $bindable(null),
		class: class_name,
		child,
		...rest_props
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		child?: Snippet<[{ props: Record<string, unknown> }]>;
	} = $props();

	const merged_props = $derived({
		...rest_props,
		class: cn("bg-muted gap-2 rounded-4xl border px-2.5 text-sm font-medium [&_svg:not([class*='size-'])]:size-4 flex items-center [&_svg]:pointer-events-none", class_name),
		"data-slot": "button-group-text",
	});
</script>

{#if child}
	{@render child({ props: merged_props })}
{:else}
	<div bind:this={ref} {...merged_props}>
		{@render merged_props.children?.()}
	</div>
{/if}
