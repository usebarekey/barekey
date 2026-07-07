<script lang="ts">
	import { Dialog as DialogPrimitive } from "bits-ui";

	let {
		ref = $bindable(null),
		type = "button",
		...rest_props
	}: DialogPrimitive.TriggerProps = $props();
</script>

<DialogPrimitive.Trigger bind:ref data-slot="dialog-trigger" {type} {...rest_props} />
