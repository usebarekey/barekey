<script lang="ts" module>
	import { tv, type VariantProps } from "tailwind-variants";

	/**
 * Tailwind variants for empty-state media containers.
 */
	export const empty_media_variants = tv({
		base: "mb-2 flex shrink-0 items-center justify-center [&_svg]:pointer-events-none [&_svg]:shrink-0",
		variants: {
			variant: {
				default: "bg-transparent",
				icon: "bg-muted text-foreground flex size-10 shrink-0 items-center justify-center rounded-lg [&_svg:not([class*='size-'])]:size-6",
			},
		},
		defaultVariants: {
			variant: "default",
		},
	});

	/**
 * Variant names supported by empty-state media containers.
 */
	export type EmptyMediaVariant = VariantProps<typeof empty_media_variants>["variant"];
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
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & { variant?: EmptyMediaVariant } = $props();
</script>

<div
	bind:this={ref}
	data-slot="empty-icon"
	data-variant={variant}
	class={cn(empty_media_variants({ variant }), class_name)}
	{...rest_props}
>
	{@render children?.()}
</div>
