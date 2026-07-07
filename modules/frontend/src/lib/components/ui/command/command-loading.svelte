<script lang="ts">
	import { Command as CommandPrimitive } from "bits-ui";

	let { ref = $bindable(null), ...rest_props }: CommandPrimitive.LoadingProps = $props();
</script>

<CommandPrimitive.Loading bind:ref {...rest_props} />
