<script lang="ts">
	import { cn, type WithElementRef, type WithoutChildren } from "$lib/utils";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: class_name,
		...rest_props
	}: WithoutChildren<WithElementRef<HTMLAttributes<HTMLDivElement>>> = $props();
</script>

<div
	bind:this={ref}
	data-slot="skeleton"
	class={cn("bg-muted rounded-xl animate-pulse", class_name)}
	{...rest_props}
></div>
