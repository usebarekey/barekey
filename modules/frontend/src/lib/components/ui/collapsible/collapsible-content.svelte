<script lang="ts">
	import { Collapsible as CollapsiblePrimitive } from "bits-ui";

	let { ref = $bindable(null), ...rest_props }: CollapsiblePrimitive.ContentProps = $props();
</script>

<CollapsiblePrimitive.Content bind:ref data-slot="collapsible-content" {...rest_props} />
