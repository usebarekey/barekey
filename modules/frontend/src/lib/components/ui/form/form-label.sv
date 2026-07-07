<script lang="ts">
	import * as FormPrimitive from "formsnap";
	import { Label } from "$lib/components/ui/label";
	import { cn, type WithoutChild } from "$lib/utils";

	let {
		ref = $bindable(null),
		children,
		class: class_name,
		...rest_props
	}: WithoutChild<FormPrimitive.LabelProps> = $props();
</script>

<FormPrimitive.Label {...rest_props} bind:ref>
	{#snippet child({ props })}
		<Label
			{...props}
			data-slot="form-label"
			class={cn("data-[fs-error]:text-destructive", class_name)}
		>
			{@render children?.()}
		</Label>
	{/snippet}
</FormPrimitive.Label>
