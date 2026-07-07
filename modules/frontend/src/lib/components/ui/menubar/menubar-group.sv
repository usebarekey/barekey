<script lang="ts">
	import { Menubar as MenubarPrimitive } from "bits-ui";

	let {
		ref = $bindable(null),
		...rest_props
	}: MenubarPrimitive.GroupProps & {
		inset?: boolean;
	} = $props();
</script>

<MenubarPrimitive.Group bind:ref data-slot="menubar-group" {...rest_props} />
