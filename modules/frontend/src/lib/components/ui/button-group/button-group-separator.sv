<script lang="ts">
	import { cn } from "$lib/utils";
	import type { ComponentProps } from "svelte";
	import { Separator } from "$lib/components/ui/separator";

	let {
		ref = $bindable(null),
		class: class_name,
		orientation = "vertical",
		...rest_props
	}: ComponentProps<typeof Separator> = $props();
</script>

<Separator
	bind:ref
	data-slot="button-group-separator"
	{orientation}
	class={cn(
		"bg-input relative self-stretch data-[orientation=horizontal]:mx-px data-[orientation=horizontal]:w-auto data-[orientation=vertical]:my-px data-[orientation=vertical]:h-auto",
		class_name
	)}
	{...rest_props}
/>
