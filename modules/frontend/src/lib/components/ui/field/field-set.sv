<script lang="ts">
	import { cn, type WithElementRef } from "$lib/utils";
	import type { HTMLFieldsetAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: class_name,
		children,
		...rest_props
	}: WithElementRef<HTMLFieldsetAttributes> = $props();
</script>

<fieldset
	bind:this={ref}
	data-slot="field-set"
	class={cn("gap-6 has-[>[data-slot=checkbox-group]]:gap-3 has-[>[data-slot=radio-group]]:gap-3 flex flex-col", class_name)}
	{...rest_props}
>
	{@render children?.()}
</fieldset>
