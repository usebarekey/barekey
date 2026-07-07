<script lang="ts">
	import { Accordion as AccordionPrimitive } from "bits-ui";
	import { cn, type WithoutChild } from "$lib/utils";

	let {
		ref = $bindable(null),
		class: class_name,
		children,
		...rest_props
	}: WithoutChild<AccordionPrimitive.ContentProps> = $props();
</script>

<AccordionPrimitive.Content
	bind:ref
	data-slot="accordion-content"
	class="data-open:animate-accordion-down data-closed:animate-accordion-up px-4 text-sm overflow-hidden"
	{...rest_props}
>
	<div
		class={cn(
			"pt-0 pb-4 [&_a]:hover:text-foreground [&_a]:underline [&_a]:underline-offset-3 [&_p:not(:last-child)]:mb-4",
			class_name
		)}
	>
		{@render children?.()}
	</div>
</AccordionPrimitive.Content>
