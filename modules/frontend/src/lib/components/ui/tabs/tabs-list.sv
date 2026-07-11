<script lang="ts" module>
	import { tv, type VariantProps } from "tailwind-variants";

	/**
 * Tailwind variants for tab list components.
 */
	export const tabs_list_variants = tv({
		base: "rounded-4xl p-[3px] group-data-horizontal/tabs:h-9 group-data-vertical/tabs:rounded-2xl data-[variant=line]:rounded-none group/tabs-list text-muted-foreground inline-flex w-fit items-center justify-center group-data-[orientation=vertical]/tabs:h-fit group-data-[orientation=vertical]/tabs:flex-col",
		variants: {
			variant: {
				default: "cn-tabs-list-variant-default bg-muted",
				line: "cn-tabs-list-variant-line gap-1 bg-transparent",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	});

	/**
 * Variant names supported by tab lists.
 */
	export type TabsListVariant = VariantProps<typeof tabs_list_variants>["variant"];
</script>

<script lang="ts">
	import { Tabs as TabsPrimitive } from "bits-ui";
	import { cn } from "$lib/utils";

	let {
		ref = $bindable(null),
		variant = "default",
		class: class_name,
		...rest_props
	}: TabsPrimitive.ListProps & {
		variant?: TabsListVariant;
	} = $props();
</script>

<TabsPrimitive.List
	bind:ref
	data-slot="tabs-list"
	data-variant={variant}
	class={cn(tabs_list_variants({ variant }), class_name)}
	{...rest_props}
/>
