<script lang="ts">
	import { Menubar as MenubarPrimitive } from "bits-ui";

	let { ...rest_props }: MenubarPrimitive.PortalProps = $props();
</script>

<MenubarPrimitive.Portal {...rest_props} />
