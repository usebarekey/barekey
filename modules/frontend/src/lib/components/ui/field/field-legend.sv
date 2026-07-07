<script lang="ts">
	import { cn, type WithElementRef } from "$lib/utils";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: class_name,
		variant = "legend",
		children,
		...rest_props
	}: WithElementRef<HTMLAttributes<HTMLLegendElement>> & {
		variant?: "legend" | "label";
	} = $props();
</script>

<legend
	bind:this={ref}
	data-slot="field-legend"
	data-variant={variant}
	class={cn("mb-3 font-medium data-[variant=label]:text-sm data-[variant=legend]:text-base", class_name)}
	{...rest_props}
>
	{@render children?.()}
</legend>
