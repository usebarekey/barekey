<script lang="ts">
	import { Menubar as MenubarPrimitive } from "bits-ui";
	import { cn, type WithoutChild } from "$lib/utils";
	import { IconCheck } from "@tabler/icons-svelte";

	let {
		ref = $bindable(null),
		class: class_name,
		inset,
		children: children_prop,
		...rest_props
	}: WithoutChild<MenubarPrimitive.RadioItemProps> & {
		inset?: boolean;
	} = $props();
</script>

<MenubarPrimitive.RadioItem
	bind:ref
	data-slot="menubar-radio-item"
	data-inset={inset}
	class={cn(
		"focus:bg-accent focus:text-accent-foreground focus:**:text-accent-foreground gap-2.5 rounded-xl py-2 pr-3 pl-9.5 text-sm data-disabled:opacity-50 data-inset:pl-9.5 [&_svg:not([class*='size-'])]:size-4 relative flex cursor-default items-center outline-hidden select-none data-disabled:pointer-events-none [&_svg]:pointer-events-none [&_svg]:shrink-0",
		class_name
	)}
	{...rest_props}
>
	{#snippet children({ checked })}
		<span
			class="left-3 size-4 [&_svg:not([class*='size-'])]:size-4 pointer-events-none absolute flex items-center justify-center"
		>
			{#if checked}
				<IconCheck  />
			{/if}
		</span>
		{@render children_prop?.({ checked })}
	{/snippet}
</MenubarPrimitive.RadioItem>
