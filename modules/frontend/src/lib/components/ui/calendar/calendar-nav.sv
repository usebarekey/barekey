<script lang="ts">
	import { cn, type WithElementRef } from "$lib/utils";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: class_name,
		children,
		...rest_props
	}: WithElementRef<HTMLAttributes<HTMLElement>> = $props();
</script>

<nav
	{...rest_props}
	bind:this={ref}
	class={cn("absolute inset-x-0 top-0 flex w-full items-center justify-between gap-1", class_name)}
>
	{@render children?.()}
</nav>
