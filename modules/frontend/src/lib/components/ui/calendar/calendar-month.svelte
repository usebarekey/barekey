<script lang="ts">
	import { type WithElementRef, cn } from "$lib/utils";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: class_name,
		children,
		...rest_props
	}: WithElementRef<HTMLAttributes<HTMLElement>> = $props();
</script>

<div {...rest_props} bind:this={ref} class={cn("flex w-full flex-col gap-4", class_name)}>
	{@render children?.()}
</div>
