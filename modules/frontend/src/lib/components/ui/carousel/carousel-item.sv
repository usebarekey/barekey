<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import { get_embla_context } from "$lib/components/ui/carousel/context.js";
	import { cn, type WithElementRef } from "$lib/utils.js";

	let {
		ref = $bindable(null),
		class: class_name,
		children,
		...rest_props
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();

	const embla_context = get_embla_context("<Carousel.Item/>");
</script>

<div
	bind:this={ref}
	data-slot="carousel-item"
	role="group"
	aria-roledescription="slide"
	class={cn(
		"min-w-0 shrink-0 grow-0 basis-full",
		embla_context.orientation === "horizontal" ? "ps-4" : "pt-4",
		class_name
	)}
	data-embla-slide=""
	{...rest_props}
>
	{@render children?.()}
</div>
