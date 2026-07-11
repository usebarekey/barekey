<script lang="ts">
	import type { WithoutChildren } from "bits-ui";
	import { get_embla_context } from "$lib/components/ui/carousel/context.js";
	import { cn } from "$lib/utils.js";
	import { Button, type Props } from "$lib/components/ui/button/index.js";
	import { IconChevronRight } from '@tabler/icons-svelte';

	let {
		ref = $bindable(null),
		class: class_name,
		variant = "outline",
		size = "icon-sm",
		...rest_props
	}: WithoutChildren<Props> = $props();

	const embla_context = get_embla_context("<Carousel.Next/>");
</script>

<Button
	data-slot="carousel-next"
	{variant}
	{size}
	aria-disabled={!embla_context.can_scroll_next}
	disabled={!embla_context.can_scroll_next}
	class={cn(
		"rounded-full absolute touch-manipulation",
		embla_context.orientation === "horizontal"
			? "-end-12 top-1/2 -translate-y-1/2"
			: "start-1/2 -bottom-12 -translate-x-1/2 rotate-90",
		class_name
	)}
	onclick={embla_context.scroll_next}
	onkeydown={embla_context.handle_key_down}
	bind:ref
	{...rest_props}
>
	<IconChevronRight  />
	<span class="sr-only">Next slide</span>
</Button>
