<script lang="ts">
	import { AlertDialog as AlertDialogPrimitive } from "bits-ui";
	import {
		button_variants,
		type ButtonVariant,
		type ButtonSize,
	} from "$lib/components/ui/button";
	import { cn } from "$lib/utils";

	let {
		ref = $bindable(null),
		class: class_name,
		variant = "default",
		size = "default",
		...rest_props
	}: AlertDialogPrimitive.ActionProps & {
		variant?: ButtonVariant;
		size?: ButtonSize;
	} = $props();
</script>

<AlertDialogPrimitive.Action
	bind:ref
	data-slot="alert-dialog-action"
	class={cn(button_variants({ variant, size }), "cn-alert-dialog-action", class_name)}
	{...rest_props}
/>
