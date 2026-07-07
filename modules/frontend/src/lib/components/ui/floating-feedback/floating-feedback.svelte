<script lang="ts">
	import type { Snippet } from "svelte";
	import type { HTMLAttributes } from "svelte/elements";
	import { cn, type WithElementRef } from "$lib/utils";

	let {
		ref = $bindable(null),
		class: class_name,
		text,
		children,
		"data-state": data_state = "closed",
		...rest_props
	}: WithElementRef<HTMLAttributes<HTMLDivElement>, HTMLDivElement> & {
		text?: string;
		children?: Snippet;
	} = $props();

	const component_id = $props.id();
	const surface_gradient_id = `${component_id}-surface-gradient`;
</script>

<div
	bind:this={ref}
	data-slot="floating-feedback"
	data-state={data_state}
	role="status"
	aria-live="polite"
	class={cn(
		"text-foreground fixed top-0 left-0 z-50 inline-grid w-max max-w-[calc(100vw-1rem)] px-3 pt-1.5 pb-3.5 text-xs font-medium whitespace-nowrap opacity-0 pointer-events-none select-none will-change-transform",
		class_name
	)}
	{...rest_props}
>
	<svg
		aria-hidden="true"
		viewBox="0 0 160 36"
		preserveAspectRatio="none"
		class="absolute inset-0 h-full w-full overflow-visible"
	>
		<defs>
			<linearGradient
				id={surface_gradient_id}
				x1="0"
				y1="36"
				x2="0"
				y2="0"
				gradientUnits="userSpaceOnUse"
			>
				<stop offset="0" stop-color="currentColor" stop-opacity="0.025" />
				<stop offset="1" stop-color="currentColor" stop-opacity="0.075" />
			</linearGradient>
		</defs>
		<path
			d="M14 0.5H146C153.456 0.5 159.5 6.544 159.5 14C159.5 21.456 153.456 27.5 146 27.5H86L80 35.5L74 27.5H14C6.544 27.5 0.5 21.456 0.5 14C0.5 6.544 6.544 0.5 14 0.5Z"
			fill={`url(#${surface_gradient_id})`}
			stroke="currentColor"
			stroke-opacity="0.125"
			vector-effect="non-scaling-stroke"
			style="filter: drop-shadow(0 4px 8px rgb(0 0 0 / 0.06)) drop-shadow(0 1px 6px rgb(0 0 0 / 0.12));"
		/>
	</svg>
	<span class="relative">
		{#if text}
			{text}
		{:else}
			{@render children?.()}
		{/if}
	</span>
</div>
