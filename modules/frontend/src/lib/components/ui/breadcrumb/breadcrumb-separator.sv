<script lang="ts">
	import { cn, type WithElementRef } from "$lib/utils";
	import type { HTMLLiAttributes } from "svelte/elements";
	import { IconChevronRight } from "@tabler/icons-svelte";

	let {
		ref = $bindable(null),
		class: class_name,
		children,
		...rest_props
	}: WithElementRef<HTMLLiAttributes> = $props();
</script>

<li
	bind:this={ref}
	data-slot="breadcrumb-separator"
	role="presentation"
	aria-hidden="true"
	class={cn("[&>svg]:size-3.5", class_name)}
	{...rest_props}
>
	{#if children}
		{@render children?.()}
	{:else}
		<IconChevronRight  />
	{/if}
</li>
