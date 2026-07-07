<script lang="ts">
	import { RangeCalendar as RangeCalendarPrimitive } from "bits-ui";
	import * as RangeCalendar from "$lib/components/ui/range-calendar";
	import { cn, type WithoutChildrenOrChild } from "$lib/utils";
	import type { ButtonVariant } from "$lib/components/ui/button";
	import type { Snippet } from "svelte";
	import { isEqualMonth, type DateValue } from "@internationalized/date";

	let {
		ref = $bindable(null),
		value = $bindable(),
		placeholder = $bindable(),
		weekdayFormat: weekday_format = "short",
		class: class_name,
		buttonVariant: button_variant = "ghost",
		captionLayout: caption_layout = "label",
		locale = "en-US",
		months: months_prop,
		years,
		monthFormat: month_format_prop,
		yearFormat: year_format = "numeric",
		day,
		disableDaysOutsideMonth: disable_days_outside_month = false,
		...rest_props
	}: WithoutChildrenOrChild<RangeCalendarPrimitive.RootProps> & {
		buttonVariant?: ButtonVariant;
		captionLayout?: "dropdown" | "dropdown-months" | "dropdown-years" | "label";
		months?: RangeCalendarPrimitive.MonthSelectProps["months"];
		years?: RangeCalendarPrimitive.YearSelectProps["years"];
		monthFormat?: RangeCalendarPrimitive.MonthSelectProps["monthFormat"];
		yearFormat?: RangeCalendarPrimitive.YearSelectProps["yearFormat"];
		day?: Snippet<[{ day: DateValue; outsideMonth: boolean }]>;
	} = $props();

	const month_format = $derived.by(() => {
		if (month_format_prop) return month_format_prop;
		if (caption_layout.startsWith("dropdown")) return "short";
		return "long";
	});
</script>

<RangeCalendarPrimitive.Root
	bind:ref
	bind:value
	bind:placeholder
	weekdayFormat={weekday_format}
	disableDaysOutsideMonth={disable_days_outside_month}
	class={cn(
		"p-3 [--cell-radius:var(--radius-4xl)] [--cell-size:--spacing(8)] bg-background group/calendar p-3 [[data-slot=card-content]_&]:bg-transparent [[data-slot=popover-content]_&]:bg-transparent",
		class_name
	)}
	{locale}
	monthFormat={month_format}
	yearFormat={year_format}
	{...rest_props}
>
	{#snippet children({ months, weekdays })}
		<RangeCalendar.Months>
			<RangeCalendar.Nav>
				<RangeCalendar.PrevButton variant={button_variant} />
				<RangeCalendar.NextButton variant={button_variant} />
			</RangeCalendar.Nav>
			{#each months as month, month_index (month)}
				<RangeCalendar.Month>
					<RangeCalendar.Header>
						<RangeCalendar.Caption
							captionLayout={caption_layout}
							months={months_prop}
							monthFormat={month_format}
							{years}
							yearFormat={year_format}
							month={month.value}
							bind:placeholder
							{locale}
							monthIndex={month_index}
						/>
					</RangeCalendar.Header>

					<RangeCalendar.Grid>
						<RangeCalendar.GridHead>
							<RangeCalendar.GridRow class="select-none">
								{#each weekdays as weekday, i (i)}
									<RangeCalendar.HeadCell>
										{weekday.slice(0, 2)}
									</RangeCalendar.HeadCell>
								{/each}
							</RangeCalendar.GridRow>
						</RangeCalendar.GridHead>
						<RangeCalendar.GridBody>
							{#each month.weeks as weekDates (weekDates)}
								<RangeCalendar.GridRow class="mt-2 w-full">
									{#each weekDates as date (date)}
										<RangeCalendar.Cell {date} month={month.value}>
											{#if day}
												{@render day({
													day: date,
													outsideMonth: !isEqualMonth(date, month.value),
												})}
											{:else}
												<RangeCalendar.Day />
											{/if}
										</RangeCalendar.Cell>
									{/each}
								</RangeCalendar.GridRow>
							{/each}
						</RangeCalendar.GridBody>
					</RangeCalendar.Grid>
				</RangeCalendar.Month>
			{/each}
		</RangeCalendar.Months>
	{/snippet}
</RangeCalendarPrimitive.Root>
