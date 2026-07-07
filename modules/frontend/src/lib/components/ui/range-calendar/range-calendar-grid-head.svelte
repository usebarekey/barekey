<script lang="ts">
	import { RangeCalendar as RangeCalendarPrimitive } from "bits-ui";

	let { ref = $bindable(null), ...rest_props }: RangeCalendarPrimitive.GridHeadProps = $props();
</script>

<RangeCalendarPrimitive.GridHead bind:ref {...rest_props} />
