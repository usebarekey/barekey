<script lang="ts">
	import { Calendar as CalendarPrimitive } from "bits-ui";
	import { cn, type WithoutChildrenOrChild } from "$lib/utils";
	import { IconChevronDown } from "@tabler/icons-svelte";

	let {
		ref = $bindable(null),
		class: class_name,
		value,
		onchange,
		...rest_props
	}: WithoutChildrenOrChild<CalendarPrimitive.MonthSelectProps> = $props();
</script>

<span
	class={cn(
		"has-focus:border-ring border-input has-focus:ring-ring/50 relative flex rounded-md border shadow-xs has-focus:ring-[3px]",
		class_name
	)}
>
	<CalendarPrimitive.MonthSelect
		bind:ref
		class="bg-background dark:bg-popover dark:text-popover-foreground absolute inset-0 opacity-0"
		{...rest_props}
	>
		{#snippet child({ props, monthItems, selectedMonthItem })}
			<select {...props} {value} {onchange}>
				{#each monthItems as monthItem (monthItem.value)}
					<option
						value={monthItem.value}
						selected={value !== undefined
							? monthItem.value === value
							: monthItem.value === selectedMonthItem.value}
					>
						{monthItem.label}
					</option>
				{/each}
			</select>
			<span
				class="[&>svg]:text-muted-foreground flex h-(--cell-size) items-center gap-1 rounded-md ps-2 pe-1 text-sm font-medium select-none [&>svg]:size-3.5"
				aria-hidden="true"
			>
				{monthItems.find((item) => item.value === value)?.label || selectedMonthItem.label}
				<IconChevronDown class={cn("size-4", class_name)} />
			</span>
		{/snippet}
	</CalendarPrimitive.MonthSelect>
</span>
