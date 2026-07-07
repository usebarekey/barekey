<script lang="ts">
	import type { HTMLOptgroupAttributes } from "svelte/elements";
	import type { WithElementRef } from "$lib/utils";

	let {
		ref = $bindable(null),
		children,
		...rest_props
	}: WithElementRef<HTMLOptgroupAttributes> = $props();
</script>

<optgroup bind:this={ref} data-slot="native-select-opt-group" {...rest_props}>
	{@render children?.()}
</optgroup>
