<script lang="ts">
	import { Drawer as DrawerPrimitive } from "vaul-svelte";

	let { ...rest_props }: DrawerPrimitive.PortalProps = $props();
</script>

<DrawerPrimitive.Portal {...rest_props} />
