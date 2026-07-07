<script lang="ts">
	import { Pagination as PaginationPrimitive } from "bits-ui";

	import { cn } from "$lib/utils";

	let {
		ref = $bindable(null),
		class: class_name,
		count = 0,
		perPage: per_page = 10,
		page = $bindable(1),
		siblingCount: sibling_count = 1,
		...rest_props
	}: PaginationPrimitive.RootProps = $props();
</script>

<PaginationPrimitive.Root
	bind:ref
	bind:page
	role="navigation"
	aria-label="pagination"
	data-slot="pagination"
	{count}
	perPage={per_page}
	siblingCount={sibling_count}
	class={cn("cn-pagination mx-auto flex w-full justify-center", class_name)}
	{...rest_props}
/>
