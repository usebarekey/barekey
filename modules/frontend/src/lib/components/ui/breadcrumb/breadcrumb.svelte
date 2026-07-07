<script lang="ts">
	import type { WithElementRef } from "$lib/utils";
	import type { HTMLAttributes } from "svelte/elements";
	import { cn } from "$lib/utils";

	let {
		ref = $bindable(null),
		class: class_name,
		children,
		...rest_props
	}: WithElementRef<HTMLAttributes<HTMLElement>> = $props();
</script>

<nav
	bind:this={ref}
	data-slot="breadcrumb"
	aria-label="breadcrumb"
	class={cn("cn-breadcrumb", class_name)}
	{...rest_props}
>
	{@render children?.()}
</nav>
