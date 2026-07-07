<script lang="ts" module>
	import { tv, type VariantProps } from "tailwind-variants";

	const input_group_button_variants = tv({
		base: "gap-2 rounded-4xl text-sm flex items-center shadow-none",
		variants: {
			size: {
				xs: "h-6 gap-1 px-1.5 [&>svg:not([class*='size-'])]:size-3.5",
				sm: "cn-input-group-button-size-sm",
				"icon-xs": "size-6 p-0 has-[>svg]:p-0",
				"icon-sm": "size-8 p-0 has-[>svg]:p-0",
			},
		},
		defaultVariants: {
			size: "xs",
		},
	});

	/**
 * Size names supported by input group buttons.
 *
 * @since 0.0.1
 */
	export type InputGroupButtonSize = VariantProps<typeof input_group_button_variants>["size"];
</script>

<script lang="ts">
	import { cn } from "$lib/utils";
	import type { ComponentProps } from "svelte";
	import { Button } from "$lib/components/ui/button";

	let {
		ref = $bindable(null),
		class: class_name,
		children,
		type = "button",
		variant = "ghost",
		size = "xs",
		...rest_props
	}: Omit<ComponentProps<typeof Button>, "href" | "size"> & {
		size?: InputGroupButtonSize;
	} = $props();
</script>

<Button
	bind:ref
	{type}
	data-size={size}
	{variant}
	class={cn(input_group_button_variants({ size }), class_name)}
	{...rest_props}
>
	{@render children?.()}
</Button>
