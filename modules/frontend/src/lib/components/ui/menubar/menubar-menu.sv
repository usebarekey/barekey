<script lang="ts">
	import { Menubar as MenubarPrimitive } from "bits-ui";

	let { ...rest_props }: MenubarPrimitive.MenuProps = $props();
</script>

<MenubarPrimitive.Menu {...rest_props} />
