<script lang="ts">
	import { cn, type WithElementRef } from "$lib/utils";
	import type { HTMLAttributes } from "svelte/elements";
	import type { Snippet } from "svelte";

	let {
		ref = $bindable(null),
		class: class_name,
		children,
		errors,
		...rest_props
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		children?: Snippet;
		errors?: { message?: string }[];
	} = $props();

	const has_content = $derived.by(() => {
		if (children) return true;

		if (!errors || errors.length === 0) return false;

		if (errors.length === 1 && !errors[0]?.message) {
			return false;
		}

		return true;
	});

	const is_multiple_errors = $derived(errors && errors.length > 1);
	const single_error_message = $derived(errors && errors.length === 1 && errors[0]?.message);
</script>

{#if has_content}
	<div
		bind:this={ref}
		role="alert"
		data-slot="field-error"
		class={cn("text-destructive text-sm font-normal", class_name)}
		{...rest_props}
	>
		{#if children}
			{@render children()}
		{:else if single_error_message}
			{single_error_message}
		{:else if is_multiple_errors}
			<ul class="ml-4 flex list-disc flex-col gap-1">
				{#each errors ?? [] as error, index (index)}
					{#if error?.message}
						<li>{error.message}</li>
					{/if}
				{/each}
			</ul>
		{/if}
	</div>
{/if}
