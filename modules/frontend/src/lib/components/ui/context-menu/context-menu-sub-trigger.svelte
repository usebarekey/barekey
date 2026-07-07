<script lang="ts">
	import { ContextMenu as ContextMenuPrimitive } from "bits-ui";
	import { cn, type WithoutChild } from "$lib/utils";
	import { IconChevronRight } from "@tabler/icons-svelte";

	let {
		ref = $bindable(null),
		class: class_name,
		inset,
		children,
		...rest_props
	}: WithoutChild<ContextMenuPrimitive.SubTriggerProps> & {
		inset?: boolean;
	} = $props();
</script>

<ContextMenuPrimitive.SubTrigger
	bind:ref
	data-slot="context-menu-sub-trigger"
	data-inset={inset}
	class={cn(
		"focus:bg-accent focus:text-accent-foreground data-open:bg-accent data-open:text-accent-foreground rounded-xl px-3 py-2 text-sm data-inset:pl-9.5 [&_svg:not([class*='size-'])]:size-4 flex cursor-default items-center outline-hidden select-none data-inset:ps-8 [&_svg]:pointer-events-none [&_svg]:shrink-0",
		class_name
	)}
	{...rest_props}
>
	{@render children?.()}
	<IconChevronRight class="ml-auto" />
</ContextMenuPrimitive.SubTrigger>
