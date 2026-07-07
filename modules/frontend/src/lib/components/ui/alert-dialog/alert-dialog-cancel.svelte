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
		variant = "outline",
		size = "default",
		...rest_props
	}: AlertDialogPrimitive.CancelProps & {
		variant?: ButtonVariant;
		size?: ButtonSize;
	} = $props();
</script>

<AlertDialogPrimitive.Cancel
	bind:ref
	data-slot="alert-dialog-cancel"
	class={cn(button_variants({ variant, size }), "cn-alert-dialog-cancel", class_name)}
	{...rest_props}
/>
