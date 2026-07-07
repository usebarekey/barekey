<script lang="ts">
	import { Dialog as DialogPrimitive } from "bits-ui";

	let { open = $bindable(false), ...rest_props }: DialogPrimitive.RootProps = $props();
</script>

<DialogPrimitive.Root bind:open {...rest_props} />
