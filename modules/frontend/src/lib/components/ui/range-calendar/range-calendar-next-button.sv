<script lang="ts">
	import { RangeCalendar as RangeCalendarPrimitive } from "bits-ui";
	import { IconChevronRight } from "@tabler/icons-svelte";
	import { button_variants, type ButtonVariant } from "$lib/components/ui/button";
	import { cn } from "$lib/utils";

	let {
		ref = $bindable(null),
		class: class_name,
		children,
		variant = "ghost",
		...rest_props
	}: RangeCalendarPrimitive.NextButtonProps & {
		variant?: ButtonVariant;
	} = $props();
</script>

{#snippet Fallback()}
	<IconChevronRight class={cn("size-4", class_name)} />
{/snippet}

<RangeCalendarPrimitive.NextButton
	bind:ref
	class={cn(
		button_variants({ variant }),
		"size-(--cell-size) bg-transparent p-0 select-none disabled:opacity-50 rtl:rotate-180",
		class_name
	)}
	{...rest_props}
>
	{#if children}
		{@render children?.()}
	{:else}
		{@render Fallback()}
	{/if}
</RangeCalendarPrimitive.NextButton>
