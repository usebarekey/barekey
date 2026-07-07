<script lang="ts">
	import { cn } from "$lib/utils";
	import type { ComponentProps } from "svelte";
	import { Input } from "$lib/components/ui/input";

	let {
		ref = $bindable(null),
		value = $bindable(),
		class: class_name,
		...props
	}: ComponentProps<typeof Input> = $props();
</script>

<Input
	bind:ref
	data-slot="input-group-control"
	class={cn("rounded-none border-0 bg-transparent shadow-none ring-0 focus-visible:ring-0 aria-invalid:ring-0 dark:bg-transparent flex-1", class_name)}
	bind:value
	{...props}
/>
