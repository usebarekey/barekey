<script lang="ts">
	import { RangeCalendar as RangeCalendarPrimitive } from "bits-ui";
	import { cn } from "$lib/utils";

	let {
		ref = $bindable(null),
		class: class_name,
		...rest_props
	}: RangeCalendarPrimitive.GridProps = $props();
</script>

<RangeCalendarPrimitive.Grid
	bind:ref
	class={cn("mt-4 flex w-full border-collapse flex-col gap-1", class_name)}
	{...rest_props}
/>
