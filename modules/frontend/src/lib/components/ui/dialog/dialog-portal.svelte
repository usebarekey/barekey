<script lang="ts">
	import { Dialog as DialogPrimitive } from "bits-ui";

	let { ...rest_props }: DialogPrimitive.PortalProps = $props();
</script>

<DialogPrimitive.Portal {...rest_props} />
