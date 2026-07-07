<script lang="ts">
	import { Separator } from "$lib/components/ui/separator";
	import { cn } from "$lib/utils";
	import type { ComponentProps } from "svelte";

	let {
		ref = $bindable(null),
		class: class_name,
		...rest_props
	}: ComponentProps<typeof Separator> = $props();
</script>

<Separator
	bind:ref
	data-slot="item-separator"
	orientation="horizontal"
	class={cn("my-2", class_name)}
	{...rest_props}
/>
