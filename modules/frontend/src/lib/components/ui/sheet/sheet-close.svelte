<script lang="ts">
	import { Dialog as SheetPrimitive } from "bits-ui";

	let { ref = $bindable(null), ...rest_props }: SheetPrimitive.CloseProps = $props();
</script>

<SheetPrimitive.Close bind:ref data-slot="sheet-close" {...rest_props} />
