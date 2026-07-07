<script lang="ts">
	import { Pagination as PaginationPrimitive } from "bits-ui";
	import { cn } from "$lib/utils";
	import { button_variants } from "$lib/components/ui/button";
	import { IconChevronLeft } from "@tabler/icons-svelte";

	let {
		ref = $bindable(null),
		class: class_name,
		...rest_props
	}: PaginationPrimitive.PrevButtonProps = $props();
</script>

<PaginationPrimitive.PrevButton
	bind:ref
	aria-label="Go to previous page"
	class={cn(
		button_variants({ variant: "ghost", size: "default" }),
		"pl-2!",
		class_name
	)}
	{...rest_props}
>
	<IconChevronLeft data-icon="inline-start" />
	<span class="cn-pagination-previous-text hidden sm:block">Previous</span>
</PaginationPrimitive.PrevButton>
