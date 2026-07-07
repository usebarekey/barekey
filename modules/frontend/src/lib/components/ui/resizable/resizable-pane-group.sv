<script lang="ts">
	import * as ResizablePrimitive from "paneforge";
	import { cn } from "$lib/utils";

	let {
		ref = $bindable(null),
		this: pane_group = $bindable(),
		class: class_name,
		...rest_props
	}: ResizablePrimitive.PaneGroupProps & {
		this?: ResizablePrimitive.PaneGroup;
	} = $props();
</script>

<ResizablePrimitive.PaneGroup
	bind:ref
	bind:this={pane_group}
	data-slot="resizable-pane-group"
	class={cn(
		"cn-resizable-panel-group flex h-full w-full data-[direction=vertical]:flex-col",
		class_name
	)}
	{...rest_props}
/>
