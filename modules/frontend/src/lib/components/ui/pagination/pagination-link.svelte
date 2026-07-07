<script lang="ts">
	import { Pagination as PaginationPrimitive } from "bits-ui";
	import { cn } from "$lib/utils";
	import { button_variants, type ButtonSize } from "$lib/components/ui/button";
	let {
		ref = $bindable(null),
		class: class_name,
		size = "icon",
		isActive: is_active,
		page,
		children,
		...rest_props
	}: PaginationPrimitive.PageProps & {
		size?: ButtonSize;
		isActive: boolean;
	} = $props();
</script>

{#snippet Fallback()}
	{page.value}
{/snippet}

<PaginationPrimitive.Page
	bind:ref
	{page}
	aria-current={is_active ? "page" : undefined}
	data-slot="pagination-link"
	data-active={is_active}
	data-size={size}
	class={cn(
		button_variants({ size, variant: is_active ? "outline" : "ghost" }),
		"cn-pagination-link",
		class_name
	)}
	{...rest_props}
>
	{#if children}
		{@render children?.()}
	{:else}
		{@render Fallback()}
	{/if}
</PaginationPrimitive.Page>
