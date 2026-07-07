<script lang="ts" module>
	import { tv, type VariantProps } from "tailwind-variants";
	/**
 * Tailwind variants for input group addons.
 *
 * @since 0.0.1
 */
	export const input_group_addon_variants = tv({
		base: "text-muted-foreground **:data-[slot=kbd]:bg-muted-foreground/10 h-auto gap-2 py-2 text-sm font-medium group-data-[disabled=true]/input-group:opacity-50 **:data-[slot=kbd]:rounded-4xl **:data-[slot=kbd]:px-1.5 [&>svg:not([class*='size-'])]:size-4 flex cursor-text items-center justify-center select-none",
		variants: {
			align: {
				"inline-start": "pl-3 has-[>button]:-ml-1 has-[>kbd]:ml-[-0.15rem] order-first",
				"inline-end": "pr-3 has-[>button]:-mr-1 has-[>kbd]:mr-[-0.15rem] order-last",
				"block-start":
					"px-3 pt-3 group-has-[>input]/input-group:pt-3 [.border-b]:pb-3 order-first w-full justify-start",
				"block-end": "px-3 pb-3 group-has-[>input]/input-group:pb-3 [.border-t]:pt-3 order-last w-full justify-start",
			},
		},
		defaultVariants: {
			align: "inline-start",
		},
	});

	/**
 * Alignment values supported by input group addons.
 *
 * @since 0.0.1
 */
	export type InputGroupAddonAlign = VariantProps<typeof input_group_addon_variants>["align"];
</script>

<script lang="ts">
	import { cn, type WithElementRef } from "$lib/utils";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: class_name,
		children,
		align = "inline-start",
		...rest_props
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		align?: InputGroupAddonAlign;
	} = $props();
</script>

<div
	bind:this={ref}
	role="group"
	data-slot="input-group-addon"
	data-align={align}
	class={cn(input_group_addon_variants({ align }), class_name)}
	onclick={(e) => {
		if ((e.target as HTMLElement).closest("button")) {
			return;
		}
		e.currentTarget.parentElement?.querySelector("input")?.focus();
	}}
	{...rest_props}
>
	{@render children?.()}
</div>
