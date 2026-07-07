import type { Tooltip } from "layerchart";
import { type Component, getContext, setContext, type Snippet } from "svelte";

/**
 * CSS selector prefixes for chart color theme scopes.
 *
 * @since 0.0.1
 */
export const themes = { light: "", dark: ".dark" } as const;

/**
 * Per-series chart display configuration.
 *
 * @since 0.0.1
 */
export type ChartConfig = {
	[k in string]: {
		label?: string;
		icon?: Component;
	} & (
		| { color?: string; theme?: never }
		| { color?: never; theme: Record<keyof typeof themes, string> }
	);
};

/**
 * Extracts the parameter object accepted by a Svelte snippet.
 *
 * @since 0.0.1
 */
export type ExtractSnippetParams<T> = T extends Snippet<[infer P]> ? P : never;

/**
 * LayerChart tooltip series payload.
 *
 * @since 0.0.1
 */
export type TooltipPayload = Tooltip.TooltipSeries;

/**
 * Finds chart item configuration using payload, key, and raw datum labels.
 *
 * @param config Chart configuration keyed by series name.
 * @param payload Tooltip series payload.
 * @param key Preferred lookup key.
 * @param data Optional raw datum for fallback label lookup.
 * @returns Matching chart item configuration when present.
 * @since 0.0.1
 */
export function get_payload_config_from_payload(
	config: ChartConfig,
	payload: TooltipPayload,
	key: string,
	data?: Record<string, unknown> | null,
) {
	if (typeof payload !== "object" || payload === null) return undefined;

	const payload_config =
		"config" in payload && typeof payload.config === "object" && payload.config !== null
			? payload.config
			: undefined;

	let config_label_key: string = key;

	if (payload.key === key) {
		config_label_key = payload.key;
	} else if (payload.label === key) {
		config_label_key = payload.label;
	} else if (key in payload && typeof payload[key as keyof typeof payload] === "string") {
		config_label_key = payload[key as keyof typeof payload] as string;
	} else if (
		payload_config !== undefined &&
		key in payload_config &&
		typeof payload_config[key as keyof typeof payload_config] === "string"
	) {
		config_label_key = payload_config[key as keyof typeof payload_config] as string;
	} else if (data != null && key in data && typeof data[key] === "string") {
		config_label_key = data[key] as string;
	}

	return config_label_key in config
		? config[config_label_key]
		: config[key as keyof typeof config];
}

type ChartContextValue = {
	config: ChartConfig;
};

const chart_context_key = Symbol("chart-context");

/**
 * Stores chart configuration in Svelte context.
 *
 * @param value Chart context value.
 * @returns The stored chart context value.
 * @since 0.0.1
 */
export function set_chart_context(value: ChartContextValue) {
	return setContext(chart_context_key, value);
}

/**
 * Reads chart configuration from Svelte context.
 *
 * @returns Chart context value from the nearest provider.
 * @since 0.0.1
 */
export function use_chart() {
	return getContext<ChartContextValue>(chart_context_key);
}
