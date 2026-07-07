<script lang="ts">
	import { Tooltip as TooltipPrimitive } from "bits-ui";

	let { delayDuration: delay_duration = 0, ...rest_props }: TooltipPrimitive.ProviderProps = $props();
</script>

<TooltipPrimitive.Provider delayDuration={delay_duration} {...rest_props} />
