<script lang="ts">
	import type { Command as CommandPrimitive, Dialog as DialogPrimitive } from "bits-ui";
	import type { Snippet } from "svelte";
	import Command from "./command.sv";
	import * as Dialog from "$lib/components/ui/dialog";
	import { cn, type WithoutChildrenOrChild } from "$lib/utils";

	let {
		open = $bindable(false),
		ref = $bindable(null),
		value = $bindable(""),
		title = "Command Palette",
		description = "Search for a command to run...",
		showCloseButton: show_close_button = false,
		portalProps: portal_props,
		children,
		class: class_name,
		...rest_props
	}: WithoutChildrenOrChild<DialogPrimitive.RootProps> &
		WithoutChildrenOrChild<CommandPrimitive.RootProps> & {
			portalProps?: DialogPrimitive.PortalProps;
			children: Snippet;
			title?: string;
			description?: string;
			showCloseButton?: boolean;
			class?: string;
		} = $props();
</script>

<Dialog.Root bind:open {...rest_props}>
	<Dialog.Header class="sr-only">
		<Dialog.Title>{title}</Dialog.Title>
		<Dialog.Description>{description}</Dialog.Description>
	</Dialog.Header>
	<Dialog.Content
		class={cn("rounded-4xl! p-0 top-1/3 translate-y-0 overflow-hidden p-0", class_name)}
		showCloseButton={show_close_button}
		portalProps={portal_props}
	>
		<Command {...rest_props} bind:value bind:ref {children} />
	</Dialog.Content>
</Dialog.Root>
