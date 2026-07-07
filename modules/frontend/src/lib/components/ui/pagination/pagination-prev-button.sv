<script lang="ts">
	import { Pagination as PaginationPrimitive } from "bits-ui";
	import { IconChevronLeft } from "@tabler/icons-svelte";
	import { cn } from "$lib/utils";
	import { button_variants } from "$lib/components/ui/button";

	let {
		ref = $bindable(null),
		class: class_name,
		children,
		...rest_props
	}: PaginationPrimitive.PrevButtonProps = $props();
</script>

{#snippet Fallback()}
	<IconChevronLeft class={cn("size-4", class_name)} />
	<span>Previous</span>
{/snippet}

<PaginationPrimitive.PrevButton
	bind:ref
	aria-label="Go to previous page"
	class={cn(button_variants({ variant: "ghost" }), "pl-2!", class_name)}
	{...rest_props}
>
	{#if children}
		{@render children?.()}
	{:else}
		{@render Fallback()}
	{/if}
</PaginationPrimitive.PrevButton>
