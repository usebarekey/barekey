<script lang="ts">
	import emblaCarouselSvelte from "embla-carousel-svelte";
	import type { HTMLAttributes } from "svelte/elements";
	import { get_embla_context } from "./context.js";
	import { cn, type WithElementRef } from "$lib/utils.js";

	let {
		ref = $bindable(null),
		class: class_name,
		children,
		...rest_props
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();

	const embla_context = get_embla_context("<Carousel.Content/>");
</script>

<div
	data-slot="carousel-content"
	class="overflow-hidden"
	use:emblaCarouselSvelte={{
		options: {
			container: "[data-embla-container]",
			slides: "[data-embla-slide]",
			...embla_context.options,
			axis: embla_context.orientation === "horizontal" ? "x" : "y",
		},
		plugins: embla_context.plugins,
	}}
	onemblaInit={embla_context.on_init}
>
	<div
		bind:this={ref}
		class={cn(
			"flex",
			embla_context.orientation === "horizontal" ? "-ms-4" : "-mt-4 flex-col",
			class_name
		)}
		data-embla-container=""
		{...rest_props}
	>
		{@render children?.()}
	</div>
</div>
