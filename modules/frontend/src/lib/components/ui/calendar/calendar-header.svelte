<script lang="ts">
	import { Calendar as CalendarPrimitive } from "bits-ui";
	import { cn } from "$lib/utils";

	let {
		ref = $bindable(null),
		class: class_name,
		...rest_props
	}: CalendarPrimitive.HeaderProps = $props();
</script>

<CalendarPrimitive.Header
	bind:ref
	class={cn(
		"flex h-(--cell-size) w-full items-center justify-center gap-1.5 text-sm font-medium",
		class_name
	)}
	{...rest_props}
/>
