<script lang="ts">
	import { LinkPreview as HoverCardPrimitive } from "bits-ui";
	import { cn, type WithoutChildrenOrChild } from "$lib/utils";
	import HoverCardPortal from "./hover-card-portal.sv";
	import type { ComponentProps } from "svelte";

	let {
		ref = $bindable(null),
		class: class_name,
		align = "center",
		sideOffset: side_offset = 4,
		portalProps: portal_props,
		...rest_props
	}: HoverCardPrimitive.ContentProps & {
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof HoverCardPortal>>;
	} = $props();
</script>

<HoverCardPortal {...portal_props}>
	<HoverCardPrimitive.Content
		bind:ref
		data-slot="hover-card-content"
		{align}
		sideOffset={side_offset}
		class={cn(
			"data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 ring-foreground/5 bg-popover text-popover-foreground w-72 rounded-2xl p-4 text-sm shadow-2xl ring-1 duration-100 z-50 origin-(--transform-origin) outline-hidden",
			class_name
		)}
		{...rest_props}
	/>
</HoverCardPortal>
