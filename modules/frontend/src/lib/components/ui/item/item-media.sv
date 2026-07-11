<script lang="ts" module>
	import { tv, type VariantProps } from "tailwind-variants";

	/**
 * Tailwind variants for item media containers.
 */
	export const item_media_variants = tv({
		base: "gap-2 group-has-data-[slot=item-description]/item:translate-y-0.5 group-has-data-[slot=item-description]/item:self-start flex shrink-0 items-center justify-center [&_svg]:pointer-events-none",
		variants: {
			variant: {
				default: "bg-transparent",
				icon: "[&_svg:not([class*='size-'])]:size-4",
				image: "size-10 overflow-hidden rounded-lg group-data-[size=sm]/item:size-8 group-data-[size=xs]/item:size-6 group-data-[size=xs]/item:rounded-md [&_img]:size-full [&_img]:object-cover",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	});

	/**
 * Variant names supported by item media containers.
 */
	export type ItemMediaVariant = VariantProps<typeof item_media_variants>["variant"];
</script>

<script lang="ts">
	import { cn, type WithElementRef } from "$lib/utils";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: class_name,
		children,
		variant = "default",
		...rest_props
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & { variant?: ItemMediaVariant } = $props();
</script>

<div
	bind:this={ref}
	data-slot="item-media"
	data-variant={variant}
	class={cn(item_media_variants({ variant }), class_name)}
	{...rest_props}
>
	{@render children?.()}
</div>
