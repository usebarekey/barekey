<script lang="ts">
	import { cn, type WithElementRef } from "$lib/utils";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: class_name,
		children,
		...rest_props
	}: WithElementRef<HTMLAttributes<HTMLSpanElement>> = $props();
</script>

<span
	bind:this={ref}
	data-slot="command-shortcut"
	class={cn("text-muted-foreground group-data-selected/command-item:text-foreground ml-auto text-xs tracking-widest", class_name)}
	{...rest_props}
>
	{@render children?.()}
</span>
