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
	data-slot="breadcrumb-ellipsis"
	role="presentation"
	aria-hidden="true"
	class={cn("size-5 [&>svg]:size-4 flex items-center justify-center", class_name)}
	{...rest_props}
>
	<IconDots  />
	<span class="sr-only">More</span>
</span>
