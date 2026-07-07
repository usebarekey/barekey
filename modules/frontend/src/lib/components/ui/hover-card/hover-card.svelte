<script lang="ts">
	import { LinkPreview as HoverCardPrimitive } from "bits-ui";

	let { open = $bindable(false), ...rest_props }: HoverCardPrimitive.RootProps = $props();
</script>

<HoverCardPrimitive.Root bind:open {...rest_props} />
