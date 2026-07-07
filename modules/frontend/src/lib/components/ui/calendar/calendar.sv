<script lang="ts">
	import { Calendar as CalendarPrimitive } from "bits-ui";
	import * as Calendar from "$lib/components/ui/calendar";
	import { cn, type WithoutChildrenOrChild } from "$lib/utils";
	import type { ButtonVariant } from "$lib/components/ui/button";
	import { isEqualMonth, type DateValue } from "@internationalized/date";
	import type { Snippet } from "svelte";

	let {
		ref = $bindable(null),
		value = $bindable(),
		placeholder = $bindable(),
		class: class_name,
		weekdayFormat: weekday_format = "short",
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
	}: WithoutChildrenOrChild<CalendarPrimitive.RootProps> & {
		buttonVariant?: ButtonVariant;
		captionLayout?: "dropdown" | "dropdown-months" | "dropdown-years" | "label";
		months?: CalendarPrimitive.MonthSelectProps["months"];
		years?: CalendarPrimitive.YearSelectProps["years"];
		monthFormat?: CalendarPrimitive.MonthSelectProps["monthFormat"];
		yearFormat?: CalendarPrimitive.YearSelectProps["yearFormat"];
		day?: Snippet<[{ day: DateValue; outsideMonth: boolean }]>;
	} = $props();

	const month_format = $derived.by(() => {
		if (month_format_prop) return month_format_prop;
		if (caption_layout.startsWith("dropdown")) return "short";
		return "long";
	});
</script>

<CalendarPrimitive.Root
	bind:value={value as never}
	bind:ref
	bind:placeholder
	weekdayFormat={weekday_format}
	disableDaysOutsideMonth={disable_days_outside_month}
	class={cn(
		"p-3 [--cell-radius:var(--radius-4xl)] [--cell-size:--spacing(8)] bg-background group/calendar in-data-[slot=card-content]:bg-transparent in-data-[slot=popover-content]:bg-transparent",
		class_name
	)}
	{locale}
	monthFormat={month_format}
	yearFormat={year_format}
	{...rest_props}
>
	{#snippet children({ months, weekdays })}
		<Calendar.Months>
			<Calendar.Nav>
				<Calendar.PrevButton variant={button_variant} />
				<Calendar.NextButton variant={button_variant} />
			</Calendar.Nav>
			{#each months as month, month_index (month)}
				<Calendar.Month>
					<Calendar.Header>
						<Calendar.Caption
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
					</Calendar.Header>
					<Calendar.Grid>
						<Calendar.GridHead>
							<Calendar.GridRow class="select-none">
								{#each weekdays as weekday, i (i)}
									<Calendar.HeadCell>
										{weekday.slice(0, 2)}
									</Calendar.HeadCell>
								{/each}
							</Calendar.GridRow>
						</Calendar.GridHead>
						<Calendar.GridBody>
							{#each month.weeks as weekDates (weekDates)}
								<Calendar.GridRow class="mt-2 w-full">
									{#each weekDates as date (date)}
										<Calendar.Cell {date} month={month.value}>
											{#if day}
												{@render day({
													day: date,
													outsideMonth: !isEqualMonth(date, month.value),
												})}
											{:else}
												<Calendar.Day />
											{/if}
										</Calendar.Cell>
									{/each}
								</Calendar.GridRow>
							{/each}
						</Calendar.GridBody>
					</Calendar.Grid>
				</Calendar.Month>
			{/each}
		</Calendar.Months>
	{/snippet}
</CalendarPrimitive.Root>
