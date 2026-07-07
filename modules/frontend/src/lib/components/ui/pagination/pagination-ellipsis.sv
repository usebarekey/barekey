<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import { cn, type WithElementRef, type WithoutChildren } from "$lib/utils";
	import { IconDots } from "@tabler/icons-svelte";

	let {
		ref = $bindable(null),
		class: class_name,
		...rest_props
	}: WithoutChildren<WithElementRef<HTMLAttributes<HTMLSpanElement>>> = $props();
</script>

<span
	bind:this={ref}
	aria-hidden="true"
	data-slot="pagination-ellipsis"
	class={cn("size-9 items-center justify-center [&_svg:not([class*='size-'])]:size-4 flex items-center justify-center", class_name)}
	{...rest_props}
>
	<IconDots  />
	<span class="sr-only">More pages</span>
</span>
