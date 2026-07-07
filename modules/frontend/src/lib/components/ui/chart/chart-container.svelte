<script lang="ts">
	import { cn, type WithElementRef } from "$lib/utils.js";
	import type { HTMLAttributes } from "svelte/elements";
	import ChartStyle from "./chart-style.svelte";
	import { set_chart_context, type ChartConfig } from "./chart-utils.js";

	const uid = $props.id();

	let {
		ref = $bindable(null),
		id = uid,
		class: class_name,
		children,
		config,
		...rest_props
	}: WithElementRef<HTMLAttributes<HTMLElement>> & {
		config: ChartConfig;
	} = $props();

	const chart_id = $derived(`chart-${id || uid.replace(/:/g, "")}`);

	set_chart_context({
		get config() {
			return config;
		},
	});
</script>

<div
	bind:this={ref}
	data-chart={chart_id}
	data-slot="chart"
	class={cn(
		"flex aspect-video justify-center overflow-visible text-xs",
		"[&_.lc-highlight-point]:stroke-transparent",
		"[&_.lc-line]:stroke-border/50",
		"[&_.lc-highlight-line]:stroke-0",
		"[&_.lc-area-path]:opacity-100 [&_.lc-highlight-line]:opacity-100 [&_.lc-highlight-point]:opacity-100 [&_.lc-spline-path]:opacity-100 [&_.lc-text]:text-xs [&_.lc-text-svg]:overflow-visible",
		"[&_.lc-axis-tick]:stroke-0",
		"[&_.lc-rule-x-line:not(.lc-grid-x-rule)]:stroke-0 [&_.lc-rule-y-line:not(.lc-grid-y-rule)]:stroke-0",
		"[&_.lc-grid-x-radial-line]:stroke-border [&_.lc-grid-x-radial-circle]:stroke-border",
		"[&_.lc-grid-y-radial-line]:stroke-border [&_.lc-grid-y-radial-circle]:stroke-border",
		"[&_.lc-legend-swatch-button]:items-center [&_.lc-legend-swatch-button]:gap-1.5",
		"[&_.lc-legend-swatch-group]:items-center [&_.lc-legend-swatch-group]:gap-4",
		"[&_.lc-legend-swatch]:size-2.5 [&_.lc-legend-swatch]:rounded-[2px]",
		"[&_.lc-labels-text:not([fill])]:fill-foreground [&_text]:stroke-transparent",
		"[&_.lc-axis-tick-label]:fill-muted-foreground [&_.lc-axis-tick-label]:font-normal",
		"[&_.lc-tooltip-rects-g]:fill-transparent",
		"[&_.lc-layout-svg-g]:fill-transparent",
		"[&_.lc-root-container]:w-full",
		class_name
	)}
	{...rest_props}
>
	<ChartStyle id={chart_id} {config} />
	{@render children?.()}
</div>
