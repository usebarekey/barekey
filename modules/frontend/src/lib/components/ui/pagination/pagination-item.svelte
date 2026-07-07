<script lang="ts">
	import type { HTMLLiAttributes } from "svelte/elements";
	import type { WithElementRef } from "$lib/utils";

	let {
		ref = $bindable(null),
		children,
		...rest_props
	}: WithElementRef<HTMLLiAttributes> = $props();
</script>

<li bind:this={ref} data-slot="pagination-item" {...rest_props}>
	{@render children?.()}
</li>
