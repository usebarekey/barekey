<script lang="ts" module>
	import { tv, type VariantProps } from "tailwind-variants";

	/**
 * Tailwind variants for field components.
 */
	export const field_variants = tv({
		base: "data-[invalid=true]:text-destructive gap-3 group/field flex w-full",
		variants: {
			orientation: {
				vertical: "cn-field-orientation-vertical flex-col [&>*]:w-full [&>.sr-only]:w-auto",
				horizontal:
					"cn-field-orientation-horizontal flex-row items-center has-[>[data-slot=field-content]]:items-start [&>[data-slot=field-label]]:flex-auto has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
				responsive:
					"cn-field-orientation-responsive flex-col @md/field-group:flex-row @md/field-group:items-center @md/field-group:has-[>[data-slot=field-content]]:items-start [&>*]:w-full @md/field-group:[&>*]:w-auto [&>.sr-only]:w-auto @md/field-group:[&>[data-slot=field-label]]:flex-auto @md/field-group:has-[>[data-slot=field-content]]:[&>[role=checkbox],[role=radio]]:mt-px",
			},
		},
		defaultVariants: {
			orientation: "vertical",
		},
	});

	/**
 * Orientation values supported by field components.
 */
	export type FieldOrientation = VariantProps<typeof field_variants>["orientation"];
</script>

<script lang="ts">
	import { cn, type WithElementRef } from "$lib/utils";
	import type { HTMLAttributes } from "svelte/elements";

	let {
		ref = $bindable(null),
		class: class_name,
		orientation = "vertical",
		children,
		...rest_props
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		orientation?: FieldOrientation;
	} = $props();
</script>

<div
	bind:this={ref}
	role="group"
	data-slot="field"
	data-orientation={orientation}
	class={cn(field_variants({ orientation }), class_name)}
	{...rest_props}
>
	{@render children?.()}
</div>
