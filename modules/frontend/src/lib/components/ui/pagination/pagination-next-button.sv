<script lang="ts">
	import { Pagination as PaginationPrimitive } from "bits-ui";
	import { IconChevronRight } from "@tabler/icons-svelte";
	import { cn } from "$lib/utils";
	import { button_variants } from "$lib/components/ui/button";

	let {
		ref = $bindable(null),
		class: class_name,
		children,
		...rest_props
	}: PaginationPrimitive.NextButtonProps = $props();
</script>

{#snippet Fallback()}
	<span>Next</span>
	<IconChevronRight class={cn("size-4", class_name)} />
{/snippet}

<PaginationPrimitive.NextButton
	bind:ref
	aria-label="Go to next page"
	class={cn(button_variants({ variant: "ghost" }), "pr-2!", class_name)}
	{...rest_props}
>
	{#if children}
		{@render children?.()}
	{:else}
		{@render Fallback()}
	{/if}
</PaginationPrimitive.NextButton>
