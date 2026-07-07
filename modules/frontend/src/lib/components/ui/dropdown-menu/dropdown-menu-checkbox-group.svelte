<script lang="ts">
	import { DropdownMenu as DropdownMenuPrimitive } from "bits-ui";

	let {
		ref = $bindable(null),
		value = $bindable([]),
		...rest_props
	}: DropdownMenuPrimitive.CheckboxGroupProps = $props();
</script>

<DropdownMenuPrimitive.CheckboxGroup
	bind:ref
	bind:value
	data-slot="dropdown-menu-checkbox-group"
	{...rest_props}
/>
