<script lang="ts">
	import { Dialog as SheetPrimitive } from "bits-ui";

	let { ref = $bindable(null), ...rest_props }: SheetPrimitive.TriggerProps = $props();
</script>

<SheetPrimitive.Trigger bind:ref data-slot="sheet-trigger" {...rest_props} />
