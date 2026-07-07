<script lang="ts">
	import { cn } from "$lib/utils";
	import { Command as CommandPrimitive } from "bits-ui";

	/**
 * Bits UI command root API type.
 *
 * @since 0.0.1
 */
	export type CommandRootApi = CommandPrimitive.Root;

	let {
		api = $bindable(null),
		ref = $bindable(null),
		value = $bindable(""),
		class: class_name,
		...rest_props
	}: CommandPrimitive.RootProps & {
		api?: CommandRootApi | null;
	} = $props();
</script>

<CommandPrimitive.Root
	bind:this={api}
	bind:value
	bind:ref
	data-slot="command"
	class={cn("bg-popover text-popover-foreground rounded-4xl p-1 flex size-full flex-col overflow-hidden", class_name)}
	{...rest_props}
/>
