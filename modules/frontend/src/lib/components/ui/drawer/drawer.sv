<script lang="ts">
	import { Drawer as DrawerPrimitive } from "vaul-svelte";

	let {
		shouldScaleBackground: should_scale_background = true,
		open = $bindable(false),
		activeSnapPoint: active_snap_point = $bindable(null),
		...rest_props
	}: DrawerPrimitive.RootProps = $props();
</script>

<DrawerPrimitive.Root
	shouldScaleBackground={should_scale_background}
	bind:open
	bind:activeSnapPoint={active_snap_point}
	{...rest_props}
/>
