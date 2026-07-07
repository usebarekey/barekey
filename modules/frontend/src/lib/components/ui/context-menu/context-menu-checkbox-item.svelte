<script lang="ts">
	import { ContextMenu as ContextMenuPrimitive } from "bits-ui";
	import { cn, type WithoutChildrenOrChild } from "$lib/utils";
	import type { Snippet } from "svelte";
	import { IconCheck } from "@tabler/icons-svelte";

	let {
		ref = $bindable(null),
		checked = $bindable(false),
		indeterminate = $bindable(false),
		class: class_name,
		inset,
		children: children_prop,
		...rest_props
	}: WithoutChildrenOrChild<ContextMenuPrimitive.CheckboxItemProps> & {
		inset?: boolean;
		children?: Snippet;
	} = $props();
</script>

<ContextMenuPrimitive.CheckboxItem
	bind:ref
	bind:checked
	bind:indeterminate
	data-slot="context-menu-checkbox-item"
	data-inset={inset}
	class={cn(
		"focus:bg-accent focus:text-accent-foreground gap-2 rounded-xl py-2 pr-8 pl-3 text-sm data-inset:pl-9.5 [&_svg:not([class*='size-'])]:size-4 relative flex cursor-default items-center outline-hidden select-none data-disabled:pointer-events-none data-disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
		class_name
	)}
	{...rest_props}
>
	{#snippet children({ checked })}
		<span class="absolute right-2 pointer-events-none">
			{#if checked}
				<IconCheck  />
			{/if}
		</span>
		{@render children_prop?.()}
	{/snippet}
</ContextMenuPrimitive.CheckboxItem>
