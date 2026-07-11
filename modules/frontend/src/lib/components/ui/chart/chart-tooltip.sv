<script lang="ts">
	import { cn, type WithElementRef, type WithoutChildren } from "$lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";
	import { get_payload_config_from_payload, use_chart, type TooltipPayload } from "$lib/components/ui/chart/chart-utils.js";
	import { getChartContext, Tooltip as TooltipPrimitive } from "layerchart";
	import type { Snippet } from "svelte";

	function default_formatter(value: unknown, _payload: TooltipPayload[]) {
		return `${value}`;
	}

	let {
		ref = $bindable(null),
		class: class_name,
		hideLabel: hide_label = false,
		indicator = "dot",
		hideIndicator: hide_indicator = false,
		labelKey: label_key,
		label,
		labelFormatter: label_formatter = default_formatter,
		labelClassName: label_class_name,
		formatter,
		nameKey: name_key,
		color,
		...rest_props
	}: WithoutChildren<WithElementRef<HTMLAttributes<HTMLDivElement>>> & {
		hideLabel?: boolean;
		label?: string;
		indicator?: "line" | "dot" | "dashed";
		nameKey?: string;
		labelKey?: string;
		hideIndicator?: boolean;
		labelClassName?: string;
		labelFormatter?: ((value: unknown, payload: TooltipPayload[]) => string | number | Snippet) | null;
		formatter?: Snippet<
			[
				{
					value: unknown;
					name: string;
					item: TooltipPayload;
					index: number;
					payload: TooltipPayload[];
				},
			]
		>;
	} = $props();

	const chart = use_chart();
	const chart_context = getChartContext();

	/**
	 * Filters to series with defined values, which matters for item-based charts
	 * where only the hovered item has a value.
	 */
	const visible_series = $derived(
		chart_context.tooltip.series.filter((s: TooltipPayload) => s.value !== undefined)
	);

	const formatted_label = $derived.by(() => {
		if (hide_label || !visible_series?.length) return null;

		const [item] = visible_series;
		const tooltip_data = chart_context.tooltip.data;

		const data_label = tooltip_data != null ? chart_context.x(tooltip_data) : undefined;

		const key = label_key ?? item?.label ?? item?.key ?? "value";
		const item_config = get_payload_config_from_payload(
			chart.config,
			item,
			key,
			tooltip_data as Record<string, unknown> | null
		);

		let value: unknown;
		if (!label_key && typeof label === "string") {
			value = chart.config[label as keyof typeof chart.config]?.label ?? label;
		} else if (label_key) {
			value = item_config?.label ?? data_label;
		} else {
			value = data_label;
		}

		if (value === undefined) return null;
		if (!label_formatter) return value;
		return label_formatter(value, visible_series);
	});

	const nest_label = $derived(visible_series.length === 1 && indicator !== "dot");
</script>

{#snippet TooltipLabel()}
	{#if formatted_label}
		<div class={cn("font-medium", label_class_name)}>
			{#if typeof formatted_label === "function"}
				{@render formatted_label()}
			{:else}
				{formatted_label}
			{/if}
		</div>
	{/if}
{/snippet}

<TooltipPrimitive.Root variant="none">
	<div
		bind:this={ref}
		class={cn(
			"border-border/50 bg-background grid min-w-[9rem] items-start gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs shadow-xl",
			class_name
		)}
		{...rest_props}
	>
		{#if !nest_label}
			{@render TooltipLabel()}
		{/if}
		<div class="grid gap-1.5">
			{#each visible_series as item, i (item.key + i)}
				{@const key = `${name_key || item.key || item.label || "value"}`}
				{@const item_config = get_payload_config_from_payload(
					chart.config,
					item,
					key,
					chart_context.tooltip.data
				)}
				{@const indicator_color = color || item.config?.color || item.color}
				<div
					class={cn(
						"[&>svg]:text-muted-foreground flex w-full flex-wrap items-stretch gap-2 [&>svg]:size-2.5",
						indicator === "dot" && "items-center"
					)}
				>
					{#if formatter && item.value !== undefined && item.label}
						{@render formatter({
							value: item.value,
							name: item.label,
							item,
							index: i,
							payload: visible_series,
						})}
					{:else}
						{#if item_config?.icon}
							<item_config.icon />
						{:else if !hide_indicator}
							<div
								style="--color-bg: {indicator_color}; --color-border: {indicator_color};"
								class={cn(
									"shrink-0 rounded-[2px] border-(--color-border) bg-(--color-bg)",
									{
										"size-2.5": indicator === "dot",
										"h-full w-1": indicator === "line",
										"w-0 border-[1.5px] border-dashed bg-transparent":
											indicator === "dashed",
										"my-0.5": nest_label && indicator === "dashed",
									}
								)}
							></div>
						{/if}
						<div
							class={cn(
								"flex flex-1 shrink-0 justify-between leading-none",
								nest_label ? "items-end" : "items-center"
							)}
						>
							<div class="grid gap-1.5">
								{#if nest_label}
									{@render TooltipLabel()}
								{/if}
								<span class="text-muted-foreground">
									{item_config?.label || item.label}
								</span>
							</div>
							{#if item.value !== undefined}
								<span class="text-foreground font-mono font-medium tabular-nums">
									{item.value.toLocaleString()}
								</span>
							{/if}
						</div>
					{/if}
				</div>
			{/each}
		</div>
	</div>
</TooltipPrimitive.Root>
