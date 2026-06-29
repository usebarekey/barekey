<script lang="ts">
	import { Button } from "$lib/components/ui/button/index.js";
	import LayoutSidebar from "@tabler/icons-svelte/icons/layout-sidebar";
	import { cn } from "$lib/utils.js";
	import type { ComponentProps } from "svelte";
	import { useSidebar } from "./context.svelte.js";

	let {
		ref = $bindable(null),
		class: className,
		children,
		onclick,
		style,
		...restProps
	}: ComponentProps<typeof Button> & {
		onclick?: (e: MouseEvent) => void;
	} = $props();

	const sidebar = useSidebar();
	let isStretching = $state(false);
	let stretchDirection = $state<"open" | "close">("open");
	let stretchX = $state(1.12);
	let stretchY = $state(0.94);
	let stretchDistance = $state(3);
	let lastToggleAt = 0;
	let stretchFrame = 0;
	let stretchTimeout: ReturnType<typeof setTimeout> | undefined;

	function replayVelocityStretch() {
		const willOpen = sidebar.isMobile ? !sidebar.openMobile : !sidebar.open;
		const now = performance.now();
		const elapsed = lastToggleAt === 0 ? 420 : Math.min(now - lastToggleAt, 420);
		const velocity = 1 - elapsed / 420;

		lastToggleAt = now;
		stretchDirection = willOpen ? "open" : "close";
		stretchX = 1.1 + velocity * 0.08;
		stretchY = 0.95 - velocity * 0.04;
		stretchDistance = 2.5 + velocity * 2.5;
		isStretching = false;

		cancelAnimationFrame(stretchFrame);
		clearTimeout(stretchTimeout);

		stretchFrame = requestAnimationFrame(() => {
			isStretching = true;
			stretchTimeout = setTimeout(() => {
				isStretching = false;
			}, 420);
		});
	}
</script>

<Button
	bind:ref
	data-sidebar="trigger"
	data-slot="sidebar-trigger"
	variant="ghost"
	size="icon-sm"
	class={cn("cn-sidebar-trigger t-velocity-stretch", className)}
	type="button"
	data-stretching={isStretching}
	data-stretch-direction={stretchDirection}
	style={`--sidebar-stretch-x: ${stretchX.toFixed(3)}; --sidebar-stretch-y: ${stretchY.toFixed(3)}; --sidebar-stretch-distance: ${stretchDistance.toFixed(2)}px; ${style ?? ""}`}
	onclick={(e) => {
		onclick?.(e);
		replayVelocityStretch();
		sidebar.toggle();
	}}
	{...restProps}
>
	{#if children}
		{@render children()}
	{:else}
		<LayoutSidebar />
	{/if}
	<span class="sr-only">Toggle Sidebar</span>
</Button>
