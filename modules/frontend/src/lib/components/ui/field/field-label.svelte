<script lang="ts">
	import { Label } from "$lib/components/ui/label";
	import { cn } from "$lib/utils";
	import type { ComponentProps } from "svelte";

	let {
		ref = $bindable(null),
		class: class_name,
		children,
		...rest_props
	}: ComponentProps<typeof Label> = $props();
</script>

<Label
	bind:ref
	data-slot="field-label"
	class={cn(
		"has-data-checked:bg-primary/5 has-data-checked:border-primary/30 dark:has-data-checked:border-primary/20 dark:has-data-checked:bg-primary/10 gap-2 leading-snug group-data-[disabled=true]/field:opacity-50 has-[>[data-slot=field]]:rounded-xl has-[>[data-slot=field]]:border *:data-[slot=field]:p-4 group/field-label peer/field-label flex w-fit leading-snug",
		"has-[>[data-slot=field]]:w-full has-[>[data-slot=field]]:flex-col",
		class_name
	)}
	{...rest_props}
>
	{@render children?.()}
</Label>
