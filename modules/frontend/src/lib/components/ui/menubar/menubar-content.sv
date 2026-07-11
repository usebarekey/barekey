<script lang="ts">
	import { Menubar as MenubarPrimitive } from "bits-ui";
	import MenubarPortal from "$lib/components/ui/menubar/menubar-portal.sv";
	import { cn, type WithoutChildrenOrChild } from "$lib/utils";
	import type { ComponentProps } from "svelte";

	let {
		ref = $bindable(null),
		class: class_name,
		sideOffset: side_offset = 8,
		alignOffset: align_offset = -4,
		align = "start",
		side = "bottom",
		portalProps: portal_props,
		...rest_props
	}: MenubarPrimitive.ContentProps & {
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof MenubarPortal>>;
	} = $props();
</script>

<MenubarPortal {...portal_props}>
	<MenubarPrimitive.Content
		bind:ref
		data-slot="menubar-content"
		{align}
		alignOffset={align_offset}
		{side}
		sideOffset={side_offset}
		class={cn(
			"bg-popover text-popover-foreground ring-foreground/10 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 z-50 min-w-36 origin-(--bits-menubar-content-transform-origin) overflow-hidden rounded-lg p-1 shadow-md ring-1 duration-100",
			class_name
		)}
		{...rest_props}
	/>
</MenubarPortal>
