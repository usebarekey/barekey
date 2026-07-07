<script lang="ts">
	import { Button, type ButtonProps } from "$lib/components/ui/button";

	let { ref = $bindable(null), ...rest_props }: ButtonProps = $props();
</script>

<Button bind:ref type="submit" {...rest_props} />
