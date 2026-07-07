<script lang="ts">
	import * as FormPrimitive from "formsnap";
	import { cn, type WithoutChild } from "$lib/utils";

	let {
		ref = $bindable(null),
		class: class_name,
		errorClasses: error_classes,
		children: children_prop,
		...rest_props
	}: WithoutChild<FormPrimitive.FieldErrorsProps> & {
		errorClasses?: string | undefined | null;
	} = $props();
</script>

<FormPrimitive.FieldErrors
	bind:ref
	class={cn("text-destructive text-sm font-medium", class_name)}
	{...rest_props}
>
	{#snippet children({ errors, errorProps })}
		{#if children_prop}
			{@render children_prop({ errors, errorProps })}
		{:else}
			{#each errors as error (error)}
				<div {...errorProps} class={cn(error_classes)}>{error}</div>
			{/each}
		{/if}
	{/snippet}
</FormPrimitive.FieldErrors>
