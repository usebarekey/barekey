<script lang="ts" module>
	import { tv, type VariantProps } from "tailwind-variants";

	/**
 * Tailwind variants for item components.
 */
	export const item_variants = tv({
		base: "[a]:hover:bg-muted rounded-2xl border text-sm group/item focus-visible:border-ring focus-visible:ring-ring/50 flex w-full flex-wrap items-center transition-colors duration-100 outline-none focus-visible:ring-[3px] [a]:transition-colors",
		variants: {
			variant: {
				default: "border-transparent",
				outline: "border-border",
				muted: "bg-muted/50 border-transparent",
			},
			size: {
				default: "gap-3.5 px-4 py-3.5",
				sm: "gap-3.5 px-3.5 py-3",
				xs: "gap-2.5 px-3 py-2.5 in-data-[slot=dropdown-menu-content]:p-0",
			},
		},
		defaultVariants: {
			variant: "default",
			size: "default",
		},
	});

	/**
 * Size names supported by item components.
 */
	export type ItemSize = VariantProps<typeof item_variants>["size"];
	/**
 * Variant names supported by item components.
 */
	export type ItemVariant = VariantProps<typeof item_variants>["variant"];
</script>

<script lang="ts">
	import { cn, type WithElementRef } from "$lib/utils";
	import type { HTMLAttributes } from "svelte/elements";
	import type { Snippet } from "svelte";

	let {
		ref = $bindable(null),
		class: class_name,
		child,
		variant,
		size,
		...rest_props
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		child?: Snippet<[{ props: Record<string, unknown> }]>;
		variant?: ItemVariant;
		size?: ItemSize;
	} = $props();

	const merged_props = $derived({
		class: cn(item_variants({ variant, size }), class_name),
		"data-slot": "item",
		"data-variant": variant,
		"data-size": size,
		...rest_props,
	});
</script>

{#if child}
	{@render child({ props: merged_props })}
{:else}
	<div bind:this={ref} {...merged_props}>
		{@render merged_props.children?.()}
	</div>
{/if}
