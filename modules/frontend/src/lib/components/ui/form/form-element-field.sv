<script lang="ts" generics="T extends Record<string, unknown>, U extends FormPathLeaves<T>">
	import * as FormPrimitive from "formsnap";
	import type { FormPathLeaves } from "sveltekit-superforms";
	import type { HTMLAttributes } from "svelte/elements";
	import { cn, type WithElementRef, type WithoutChildren } from "$lib/utils";

	let {
		ref = $bindable(null),
		class: class_name,
		form,
		name,
		children: children_prop,
		...rest_props
	}: WithoutChildren<WithElementRef<HTMLAttributes<HTMLDivElement>>> &
		FormPrimitive.ElementFieldProps<T, U> = $props();
</script>

<FormPrimitive.ElementField {form} {name}>
	{#snippet children({ constraints, errors, tainted, value })}
		<div bind:this={ref} class={cn("space-y-2", class_name)} {...rest_props}>
			{@render children_prop?.({ constraints, errors, tainted, value: value as T[U] })}
		</div>
	{/snippet}
</FormPrimitive.ElementField>
