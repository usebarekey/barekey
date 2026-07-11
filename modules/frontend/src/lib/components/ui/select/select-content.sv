<script lang="ts">
	import { Select as SelectPrimitive } from "bits-ui";
	import SelectPortal from "$lib/components/ui/select/select-portal.sv";
	import SelectScrollUpButton from "$lib/components/ui/select/select-scroll-up-button.sv";
	import SelectScrollDownButton from "$lib/components/ui/select/select-scroll-down-button.sv";
	import { cn, type WithoutChild } from "$lib/utils";
	import type { ComponentProps } from "svelte";
	import type { WithoutChildrenOrChild } from "$lib/utils";

	let {
		ref = $bindable(null),
		class: class_name,
		sideOffset: side_offset = 4,
		portalProps: portal_props,
		children,
		preventScroll: prevent_scroll = true,
		...rest_props
	}: WithoutChild<SelectPrimitive.ContentProps> & {
		portalProps?: WithoutChildrenOrChild<ComponentProps<typeof SelectPortal>>;
	} = $props();
</script>

<SelectPortal {...portal_props}>
	<SelectPrimitive.Content
		bind:ref
		sideOffset={side_offset}
		preventScroll={prevent_scroll}
		data-slot="select-content"
		class={cn(
			"bg-popover text-popover-foreground data-open:animate-in data-closed:animate-out data-closed:fade-out-0 data-open:fade-in-0 data-closed:zoom-out-95 data-open:zoom-in-95 data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2 data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2 ring-foreground/5 min-w-36 rounded-2xl shadow-2xl ring-1 duration-100 data-[side=inline-start]:slide-in-from-right-2 data-[side=inline-end]:slide-in-from-left-2 relative isolate z-50 overflow-x-hidden overflow-y-auto",
			class_name
		)}
		{...rest_props}
	>
		<SelectScrollUpButton />
		<SelectPrimitive.Viewport
			class={cn(
				"h-(--bits-select-anchor-height) w-full min-w-(--bits-select-anchor-width) scroll-my-1"
			)}
		>
			{@render children?.()}
		</SelectPrimitive.Viewport>
		<SelectScrollDownButton />
	</SelectPrimitive.Content>
</SelectPortal>
