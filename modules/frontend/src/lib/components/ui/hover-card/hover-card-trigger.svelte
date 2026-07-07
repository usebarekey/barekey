<script lang="ts">
	import { LinkPreview as HoverCardPrimitive } from "bits-ui";

	let { ref = $bindable(null), ...rest_props }: HoverCardPrimitive.TriggerProps = $props();
</script>

<HoverCardPrimitive.Trigger bind:ref data-slot="hover-card-trigger" {...rest_props} />
