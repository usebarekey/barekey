<script lang="ts">
	import { Dialog as SheetPrimitive } from "bits-ui";

	let { open = $bindable(false), ...rest_props }: SheetPrimitive.RootProps = $props();
</script>

<SheetPrimitive.Root bind:open {...rest_props} />
