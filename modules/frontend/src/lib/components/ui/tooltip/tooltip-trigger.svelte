<script lang="ts" generics="T = never">
	import { Tooltip as TooltipPrimitive } from "bits-ui";

	let { ref = $bindable(null), ...rest_props }: TooltipPrimitive.TriggerProps<T> = $props();
</script>

<TooltipPrimitive.Trigger bind:ref data-slot="tooltip-trigger" {...rest_props} />
