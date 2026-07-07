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
	data-slot="empty-content"
	class={cn(
		"gap-4 text-sm flex w-full max-w-sm min-w-0 flex-col items-center text-balance",
		class_name
	)}
	{...rest_props}
>
	{@render children?.()}
</div>
