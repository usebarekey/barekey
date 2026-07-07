<script lang="ts">
	import { cn, type WithElementRef } from "$lib/utils";
	import type { HTMLAttributes } from "svelte/elements";
	import { Dialog as DialogPrimitive } from "bits-ui";
	import { Button } from "$lib/components/ui/button";

	let {
		ref = $bindable(null),
		class: class_name,
		children,
		showCloseButton: show_close_button = false,
		...rest_props
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		showCloseButton?: boolean;
	} = $props();
</script>

<div
	bind:this={ref}
	data-slot="dialog-footer"
	class={cn("gap-2 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end", class_name)}
	{...rest_props}
>
	{@render children?.()}
	{#if show_close_button}
		<DialogPrimitive.Close>
			{#snippet child({ props })}
				<Button variant="outline" {...props}>Close</Button>
			{/snippet}
		</DialogPrimitive.Close>
	{/if}
</div>
