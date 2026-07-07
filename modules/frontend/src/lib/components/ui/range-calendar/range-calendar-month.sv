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

<div {...rest_props} bind:this={ref} class={cn("flex flex-col", class_name)}>
	{@render children?.()}
</div>
