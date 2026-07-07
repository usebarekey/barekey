<script lang="ts">
	import { cn, type WithElementRef } from "$lib/utils";
	import type { HTMLThAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: class_name,
		children,
		...rest_props
	}: WithElementRef<HTMLThAttributes> = $props();
</script>

<th bind:this={ref} data-slot="table-head" class={cn("text-foreground h-12 px-3 text-left align-middle font-medium whitespace-nowrap [&:has([role=checkbox])]:pr-0", class_name)} {...rest_props}>
	{@render children?.()}
</th>
