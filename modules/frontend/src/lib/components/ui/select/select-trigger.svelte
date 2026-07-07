<script lang="ts">
	import { Select as SelectPrimitive } from "bits-ui";
	import { cn, type WithoutChild } from "$lib/utils";
	import { IconSelector } from "@tabler/icons-svelte";

	let {
		ref = $bindable(null),
		class: class_name,
		children,
		size = "default",
		...rest_props
	}: WithoutChild<SelectPrimitive.TriggerProps> & {
		size?: "sm" | "default";
	} = $props();
</script>

<SelectPrimitive.Trigger
	bind:ref
	data-slot="select-trigger"
	data-size={size}
	class={cn(
		"data-placeholder:text-muted-foreground bg-linear-to-t from-background/30 to-foreground/5 card card-outline focus-visible:ring-ring/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 gap-1.5 rounded-4xl px-3 py-2 text-sm transition-colors focus-visible:ring-[3px] aria-invalid:ring-[3px] data-[size=default]:h-9 data-[size=sm]:h-8 *:data-[slot=select-value]:flex *:data-[slot=select-value]:gap-1.5 [&_svg:not([class*='size-'])]:size-4 flex w-fit items-center justify-between whitespace-nowrap outline-none disabled:cursor-not-allowed disabled:opacity-50 *:data-[slot=select-value]:line-clamp-1 *:data-[slot=select-value]:flex *:data-[slot=select-value]:items-center [&_svg]:pointer-events-none [&_svg]:shrink-0",
		class_name
	)}
	{...rest_props}
>
	{@render children?.()}
	<IconSelector class="text-muted-foreground size-4 pointer-events-none" />
</SelectPrimitive.Trigger>
