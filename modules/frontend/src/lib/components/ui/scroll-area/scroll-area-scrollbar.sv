<script lang="ts">
	import { ScrollArea as ScrollAreaPrimitive } from "bits-ui";
	import { cn, type WithoutChild } from "$lib/utils";

	let {
		ref = $bindable(null),
		class: class_name,
		orientation = "vertical",
		children,
		...rest_props
	}: WithoutChild<ScrollAreaPrimitive.ScrollbarProps> = $props();
</script>

<ScrollAreaPrimitive.Scrollbar
	bind:ref
	data-slot="scroll-area-scrollbar"
	data-orientation={orientation}
	{orientation}
	class={cn(
		"data-horizontal:h-2.5 data-horizontal:flex-col data-horizontal:border-t data-horizontal:border-t-transparent data-vertical:h-auto data-vertical:w-2.5 data-vertical:border-l data-vertical:border-l-transparent flex touch-none rounded-full p-px transition-colors select-none",
		class_name
	)}
	{...rest_props}
>
	{@render children?.()}
	<ScrollAreaPrimitive.Thumb
		data-slot="scroll-area-thumb"
		class="rounded-full bg-border relative flex-1"
	/>
</ScrollAreaPrimitive.Scrollbar>

<style>
	:global([data-slot="scroll-area-scrollbar"][data-orientation="vertical"]) {
		top: var(--scroll-area-scrollbar-inset, 0.25rem) !important;
		bottom: calc(
			var(--bits-scroll-area-corner-height, 0px) +
				var(--scroll-area-scrollbar-inset, 0.25rem)
		) !important;
	}
</style>
