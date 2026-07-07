<script lang="ts">
	import { cn, type WithElementRef } from "$lib/utils";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: class_name,
		children,
		...rest_props
	}: WithElementRef<HTMLAttributes<HTMLElement>> = $props();
</script>

<kbd
	bind:this={ref}
	data-slot="kbd-group"
	class={cn("gap-1 inline-flex items-center", class_name)}
	{...rest_props}
>
	{@render children?.()}
</kbd>
