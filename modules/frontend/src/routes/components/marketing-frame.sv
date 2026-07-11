<script lang="ts">
	import { cn } from "$lib/utils.js";
	import type { Snippet } from "svelte";

	let {
		children,
		class: class_name,
	}: {
		children: Snippet;
		class?: string;
	} = $props();
</script>

<section class={cn("relative bg-linear-to-tr from-background to-card", class_name)}>
	<div aria-hidden="true" class="absolute -inset-y-5 -left-px w-px bg-border"></div>
	<div aria-hidden="true" class="absolute -inset-y-5 -right-px w-px bg-border"></div>
	<div aria-hidden="true" class="absolute -inset-x-5 -top-px h-px bg-border"></div>
	<div aria-hidden="true" class="absolute -inset-x-5 -bottom-px h-px bg-border"></div>

	<div aria-hidden="true" class="absolute -top-2.5 -left-2.5 size-5 text-border">
		<div class="absolute top-1/2 h-px w-full bg-current"></div>
		<div class="absolute left-1/2 h-full w-px bg-current"></div>
	</div>
	<div aria-hidden="true" class="absolute -right-2.5 -bottom-2.5 size-5 text-border">
		<div class="absolute top-1/2 h-px w-full bg-current"></div>
		<div class="absolute left-1/2 h-full w-px bg-current"></div>
	</div>

	{@render children()}
</section>
