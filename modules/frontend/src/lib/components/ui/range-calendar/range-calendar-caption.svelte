<script lang="ts">
	import type { ComponentProps } from "svelte";
	import type RangeCalendar from "./range-calendar.svelte";
	import RangeCalendarMonthSelect from "./range-calendar-month-select.svelte";
	import RangeCalendarYearSelect from "./range-calendar-year-select.svelte";
	import { DateFormatter, getLocalTimeZone, type DateValue } from "@internationalized/date";

	let {
		captionLayout: caption_layout,
		months,
		monthFormat: month_format,
		years,
		yearFormat: year_format,
		month,
		locale,
		placeholder = $bindable(),
		monthIndex: month_index = 0,
	}: {
		captionLayout: ComponentProps<typeof RangeCalendar>["captionLayout"];
		months: ComponentProps<typeof RangeCalendarMonthSelect>["months"];
		monthFormat: ComponentProps<typeof RangeCalendarMonthSelect>["monthFormat"];
		years: ComponentProps<typeof RangeCalendarYearSelect>["years"];
		yearFormat: ComponentProps<typeof RangeCalendarYearSelect>["yearFormat"];
		month: DateValue;
		placeholder: DateValue | undefined;
		locale: string;
		monthIndex: number;
	} = $props();

	function format_year(date: DateValue) {
		const date_obj = date.toDate(getLocalTimeZone());
		if (typeof year_format === "function") return year_format(date_obj.getFullYear());
		return new DateFormatter(locale, { year: year_format }).format(date_obj);
	}

	function format_month(date: DateValue) {
		const date_obj = date.toDate(getLocalTimeZone());
		if (typeof month_format === "function") return month_format(date_obj.getMonth() + 1);
		return new DateFormatter(locale, { month: month_format }).format(date_obj);
	}
</script>

{#snippet MonthSelect()}
	<RangeCalendarMonthSelect
		{months}
		monthFormat={month_format}
		value={month.month}
		onchange={(event) => {
			if (!placeholder) return;
			const value = Number.parseInt(event.currentTarget.value);
			const new_placeholder = placeholder.set({ month: value });
			placeholder = new_placeholder.subtract({ months: month_index });
		}}
	/>
{/snippet}

{#snippet YearSelect()}
	<RangeCalendarYearSelect {years} yearFormat={year_format} value={month.year} />
{/snippet}

{#if caption_layout === "dropdown"}
	{@render MonthSelect()}
	{@render YearSelect()}
{:else if caption_layout === "dropdown-months"}
	{@render MonthSelect()}
	{#if placeholder}
		{format_year(placeholder)}
	{/if}
{:else if caption_layout === "dropdown-years"}
	{#if placeholder}
		{format_month(placeholder)}
	{/if}
	{@render YearSelect()}
{:else}
	{format_month(month)} {format_year(month)}
{/if}
