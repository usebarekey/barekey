<script lang="ts">
	import { Popover as PopoverPrimitive } from "bits-ui";

	let { ref = $bindable(null), ...rest_props }: PopoverPrimitive.CloseProps = $props();
</script>

<PopoverPrimitive.Close bind:ref data-slot="popover-close" {...rest_props} />
