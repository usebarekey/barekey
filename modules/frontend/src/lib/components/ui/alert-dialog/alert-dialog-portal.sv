<script lang="ts">
	import { AlertDialog as AlertDialogPrimitive } from "bits-ui";

	let { ...rest_props }: AlertDialogPrimitive.PortalProps = $props();
</script>

<AlertDialogPrimitive.Portal {...rest_props} />
