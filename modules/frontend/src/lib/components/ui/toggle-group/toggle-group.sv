<script lang="ts" module>
	import { getContext, setContext } from "svelte";
	import type { VariantProps } from "tailwind-variants";
	import { toggle_variants } from "$lib/components/ui/toggle";

	type ToggleVariants = VariantProps<typeof toggle_variants>;

	interface ToggleGroupContext extends ToggleVariants {
		spacing?: number;
		orientation?: "horizontal" | "vertical";
	}

	/**
	 * Stores toggle group variant context for child items.
	 */
	export function set_toggle_group_ctx(props: ToggleGroupContext) {
		setContext("toggleGroup", props);
	}

	/**
	 * Reads toggle group variant context for child items.
	 */
	export function get_toggle_group_ctx() {
		return getContext<Required<ToggleGroupContext>>("toggleGroup");
	}
</script>

<script lang="ts">
	import { ToggleGroup as ToggleGroupPrimitive } from "bits-ui";
	import { cn } from "$lib/utils";

	let {
		ref = $bindable(null),
		value = $bindable(),
		class: class_name,
		size = "default",
		spacing = 0,
		orientation = "horizontal",
		variant = "default",
		...rest_props
	}: ToggleGroupPrimitive.RootProps &
		ToggleVariants & {
			spacing?: number;
			orientation?: "horizontal" | "vertical";
		} = $props();

	set_toggle_group_ctx({
		get variant() {
			return variant;
		},
		get size() {
			return size;
		},
		get spacing() {
			return spacing;
		},
		get orientation() {
			return orientation;
		},
	});
</script>

<ToggleGroupPrimitive.Root
	bind:value={value as never}
	bind:ref
	{orientation}
	data-slot="toggle-group"
	data-variant={variant}
	data-size={size}
	data-spacing={spacing}
	style={`--gap: ${spacing}`}
	class={cn(
		"data-[spacing=0]:data-[variant=outline]:rounded-4xl group/toggle-group flex w-fit flex-row items-center gap-[--spacing(var(--gap))] data-vertical:flex-col data-vertical:items-stretch",
		class_name
	)}
	{...rest_props}
/>
