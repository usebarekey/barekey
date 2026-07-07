<script lang="ts">
	import { Select as SelectPrimitive } from "bits-ui";

	let { ...rest_props }: SelectPrimitive.PortalProps = $props();
</script>

<SelectPrimitive.Portal {...rest_props} />
