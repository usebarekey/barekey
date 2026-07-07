<script lang="ts">
	import { cn, type WithElementRef } from "$lib/utils";
	import type { HTMLTdAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: class_name,
		children,
		...rest_props
	}: WithElementRef<HTMLTdAttributes> = $props();
</script>

<td bind:this={ref} data-slot="table-cell" class={cn("p-3 align-middle whitespace-nowrap [&:has([role=checkbox])]:pr-0", class_name)} {...rest_props}>
	{@render children?.()}
</td>
