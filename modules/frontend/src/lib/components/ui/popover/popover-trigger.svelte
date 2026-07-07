<script lang="ts">
	import { cn } from "$lib/utils";
	import { Popover as PopoverPrimitive } from "bits-ui";

	let {
		ref = $bindable(null),
		class: class_name,
		...rest_props
	}: PopoverPrimitive.TriggerProps = $props();
</script>

<PopoverPrimitive.Trigger
	bind:ref
	data-slot="popover-trigger"
	class={cn("", class_name)}
	{...rest_props}
/>
