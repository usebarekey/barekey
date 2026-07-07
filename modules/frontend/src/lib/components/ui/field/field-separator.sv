<script lang="ts">
	import { Separator } from "$lib/components/ui/separator";
	import { cn, type WithElementRef } from "$lib/utils";
	import type { HTMLAttributes } from "svelte/elements";
	import type { Snippet } from "svelte";

	let {
		ref = $bindable(null),
		class: class_name,
		children,
		...rest_props
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		children?: Snippet;
	} = $props();

	const has_content = $derived(!!children);
</script>

<div
	bind:this={ref}
	data-slot="field-separator"
	data-content={has_content}
	class={cn("-my-2 h-5 text-sm group-data-[variant=outline]/field-group:-mb-2 relative", class_name)}
	{...rest_props}
>
	<Separator class="absolute inset-0 top-1/2" />
	{#if children}
		<span
			class="text-muted-foreground px-2 bg-background relative mx-auto block w-fit"
			data-slot="field-separator-content"
		>
			{@render children()}
		</span>
	{/if}
</div>
