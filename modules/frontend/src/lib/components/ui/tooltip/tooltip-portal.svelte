<script lang="ts">
	import { Tooltip as TooltipPrimitive } from "bits-ui";

	let { ...rest_props }: TooltipPrimitive.PortalProps = $props();
</script>

<TooltipPrimitive.Portal {...rest_props} />
