<script lang="ts">
	import { ScrollArea as ScrollAreaPrimitive } from "bits-ui";
	import { Scrollbar } from "$lib/components/ui/scroll-area";
	import { cn, type WithoutChild } from "$lib/utils";

	let {
		ref = $bindable(null),
		viewportRef: viewport_ref = $bindable(null),
		class: class_name,
		orientation = "vertical",
		scrollbarXClasses: scrollbar_x_classes = "",
		scrollbarYClasses: scrollbar_y_classes = "",
		children,
		...rest_props
	}: WithoutChild<ScrollAreaPrimitive.RootProps> & {
		orientation?: "vertical" | "horizontal" | "both" | undefined;
		scrollbarXClasses?: string | undefined;
		scrollbarYClasses?: string | undefined;
		viewportRef?: HTMLElement | null;
	} = $props();
</script>

<ScrollAreaPrimitive.Root
	bind:ref
	data-slot="scroll-area"
	class={cn("relative", class_name)}
	{...rest_props}
>
	<ScrollAreaPrimitive.Viewport
		bind:ref={viewport_ref}
		data-slot="scroll-area-viewport"
		class="cn-scroll-area-viewport focus-visible:ring-ring/50 size-full rounded-[inherit] transition-[color,box-shadow] outline-none focus-visible:ring-[3px] focus-visible:outline-1"
	>
		{@render children?.()}
	</ScrollAreaPrimitive.Viewport>
	{#if orientation === "vertical" || orientation === "both"}
		<Scrollbar orientation="vertical" class={scrollbar_y_classes} />
	{/if}
	{#if orientation === "horizontal" || orientation === "both"}
		<Scrollbar orientation="horizontal" class={scrollbar_x_classes} />
	{/if}
	<ScrollAreaPrimitive.Corner />
</ScrollAreaPrimitive.Root>
