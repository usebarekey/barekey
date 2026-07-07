<script lang="ts">
	import { Command as CommandPrimitive } from "bits-ui";
	import { cn } from "$lib/utils";
	import * as InputGroup from "$lib/components/ui/input-group";
	import { IconSearch } from "@tabler/icons-svelte";

	let {
		ref = $bindable(null),
		class: class_name,
		value = $bindable(""),
		...rest_props
	}: CommandPrimitive.InputProps = $props();
</script>

<div data-slot="command-input-wrapper" class="p-1 pb-0">
	<InputGroup.Root class="bg-input/30 h-9">
		<CommandPrimitive.Input
			{value}
			data-slot="command-input"
			class={cn(
				"w-full text-sm outline-hidden disabled:cursor-not-allowed disabled:opacity-50",
				class_name
			)}
			{...rest_props}
		>
			{#snippet child({ props })}
				<InputGroup.Input {...props} bind:value bind:ref />
			{/snippet}
		</CommandPrimitive.Input>
		<InputGroup.Addon>
			<IconSearch class="size-4 shrink-0 opacity-50" />
		</InputGroup.Addon>
	</InputGroup.Root>
</div>
