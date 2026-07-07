<script lang="ts">
	import { Accordion as AccordionPrimitive } from "bits-ui";
	import { cn } from "$lib/utils";

	let {
		ref = $bindable(null),
		value = $bindable(),
		class: class_name,
		...rest_props
	}: AccordionPrimitive.RootProps = $props();
</script>

<AccordionPrimitive.Root
	bind:ref
	bind:value={value as never}
	data-slot="accordion"
	class={cn("overflow-hidden rounded-2xl border flex w-full flex-col", class_name)}
	{...rest_props}
/>
