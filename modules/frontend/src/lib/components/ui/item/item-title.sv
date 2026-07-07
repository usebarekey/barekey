<script lang="ts">
	import { cn, type WithElementRef } from "$lib/utils";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: class_name,
		children,
		...rest_props
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div
	bind:this={ref}
	data-slot="item-title"
	class={cn("font-heading gap-2 text-sm leading-snug font-medium underline-offset-4 line-clamp-1 flex w-fit items-center", class_name)}
	{...rest_props}
>
	{@render children?.()}
</div>
