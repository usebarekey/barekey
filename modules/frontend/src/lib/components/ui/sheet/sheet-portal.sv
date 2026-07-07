<script lang="ts">
	import { Dialog as SheetPrimitive } from "bits-ui";

	let { ...rest_props }: SheetPrimitive.PortalProps = $props();
</script>

<SheetPrimitive.Portal {...rest_props} />
