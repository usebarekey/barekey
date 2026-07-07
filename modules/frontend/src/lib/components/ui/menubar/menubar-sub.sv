<script lang="ts">
	import { Menubar as MenubarPrimitive } from "bits-ui";

	let { open = $bindable(false), ...rest_props }: MenubarPrimitive.SubProps = $props();
</script>

<MenubarPrimitive.Sub bind:open {...rest_props} />
