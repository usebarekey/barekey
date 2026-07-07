<script lang="ts">
	import type { HTMLAttributes } from "svelte/elements";
	import type { WithElementRef } from "$lib/utils";
	import { cn } from "$lib/utils";
	import { IconMinus } from "@tabler/icons-svelte";

	let {
		ref = $bindable(null),
		class: class_name,
		children,
		...rest_props
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> = $props();
</script>

<div
	bind:this={ref}
	data-slot="input-otp-separator"
	role="separator"
	class={cn("[&_svg:not([class*='size-'])]:size-4 flex items-center", class_name)}
	{...rest_props}
>
	{#if children}
		{@render children?.()}
	{:else}
		<IconMinus  />
	{/if}
</div>
