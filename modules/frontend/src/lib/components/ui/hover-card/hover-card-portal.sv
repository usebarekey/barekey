<script lang="ts">
	import { LinkPreview as HoverCardPrimitive } from "bits-ui";

	let { ...rest_props }: HoverCardPrimitive.PortalProps = $props();
</script>

<HoverCardPrimitive.Portal {...rest_props} />
