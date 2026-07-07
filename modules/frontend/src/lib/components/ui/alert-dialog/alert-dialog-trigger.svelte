<script lang="ts">
	import { AlertDialog as AlertDialogPrimitive } from "bits-ui";

	let { ref = $bindable(null), ...rest_props }: AlertDialogPrimitive.TriggerProps = $props();
</script>

<AlertDialogPrimitive.Trigger bind:ref data-slot="alert-dialog-trigger" {...rest_props} />
