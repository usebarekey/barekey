<script lang="ts" generics="T extends Record<string, unknown>, U extends FormPath<T>">
	import * as FormPrimitive from "formsnap";
	import type { FormPath } from "sveltekit-superforms";
	import { cn, type WithElementRef, type WithoutChildren } from "$lib/utils";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: class_name,
		form,
		name,
		children: children_prop,
		...rest_props
	}: FormPrimitive.FieldProps<T, U> &
		WithoutChildren<WithElementRef<HTMLAttributes<HTMLDivElement>>> = $props();
</script>

<FormPrimitive.Field {form} {name}>
	{#snippet children({ constraints, errors, tainted, value })}
		<div
			bind:this={ref}
			data-slot="form-item"
			class={cn("space-y-2", class_name)}
			{...rest_props}
		>
			{@render children_prop?.({ constraints, errors, tainted, value: value as T[U] })}
		</div>
	{/snippet}
</FormPrimitive.Field>
