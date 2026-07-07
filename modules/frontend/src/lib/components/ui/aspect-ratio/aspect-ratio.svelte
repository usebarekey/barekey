<script lang="ts">
	import { AspectRatio as AspectRatioPrimitive } from "bits-ui";

	let { ref = $bindable(null), ...rest_props }: AspectRatioPrimitive.RootProps = $props();
</script>

<AspectRatioPrimitive.Root bind:ref data-slot="aspect-ratio" {...rest_props} />
