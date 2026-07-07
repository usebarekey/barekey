<script lang="ts">
	import { Pagination as PaginationPrimitive } from "bits-ui";
	import { cn } from "$lib/utils";
	import { button_variants } from "$lib/components/ui/button";
	import { IconChevronRight } from "@tabler/icons-svelte";

	let {
		ref = $bindable(null),
		class: class_name,
		...rest_props
	}: PaginationPrimitive.NextButtonProps = $props();
</script>

<PaginationPrimitive.NextButton
	bind:ref
	aria-label="Go to next page"
	class={cn(
		button_variants({ variant: "ghost", size: "default" }),
		"pr-2!",
		class_name
	)}
	{...rest_props}
>
	<span class="cn-pagination-next-text hidden sm:block">Next</span>
	<IconChevronRight data-icon="inline-end" />
</PaginationPrimitive.NextButton>
