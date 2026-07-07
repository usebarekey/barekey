<script lang="ts">
	import { Select as SelectPrimitive } from "bits-ui";
	import { cn, type WithoutChildrenOrChild } from "$lib/utils";
	import { IconChevronUp } from "@tabler/icons-svelte";

	let {
		ref = $bindable(null),
		class: class_name,
		...rest_props
	}: WithoutChildrenOrChild<SelectPrimitive.ScrollUpButtonProps> = $props();
</script>

<SelectPrimitive.ScrollUpButton
	bind:ref
	data-slot="select-scroll-up-button"
	class={cn("bg-popover z-10 flex cursor-default items-center justify-center py-1 [&_svg:not([class*='size-'])]:size-4 top-0 w-full", class_name)}
	{...rest_props}
>
	<IconChevronUp  />
</SelectPrimitive.ScrollUpButton>
