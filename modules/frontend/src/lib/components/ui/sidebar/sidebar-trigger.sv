<script lang="ts">
	import { Button } from "$lib/components/ui/button/index.js";
	import LayoutSidebar from "@tabler/icons-svelte/icons/layout-sidebar";
	import { cn } from "$lib/utils.js";
	import { Effect, type Fiber } from "effect";
	import { onDestroy } from "svelte";
	import type { ComponentProps } from "svelte";
	import { use_sidebar } from "./context.svelte.js";

	let {
		ref = $bindable(null),
		class: class_name,
		children,
		onclick,
		style,
		...rest_props
	}: ComponentProps<typeof Button> & {
		onclick?: (e: MouseEvent) => void;
	} = $props();

	const sidebar = use_sidebar();
	let is_stretching = $state(false);
	let stretch_direction = $state<"open" | "close">("open");
	let stretch_x = $state(1.12);
	let stretch_y = $state(0.94);
	let stretch_distance = $state(3);
	let last_toggle_at = 0;
	let stretch_fiber: Fiber.Fiber<void> | undefined;

	const play_stretch_animation = Effect.gen(function* () {
		yield* Effect.callback<void>((resume) => {
			const frame = requestAnimationFrame(() => resume(Effect.void));

			return Effect.sync(() => {
				cancelAnimationFrame(frame);
			});
		});

		is_stretching = true;

		yield* Effect.sleep("420 millis");

		is_stretching = false;
	});

	function replay_velocity_stretch() {
		const will_open = sidebar.is_mobile ? !sidebar.open_mobile : !sidebar.open;
		const now = performance.now();
		const elapsed = last_toggle_at === 0 ? 420 : Math.min(now - last_toggle_at, 420);
		const velocity = 1 - elapsed / 420;

		last_toggle_at = now;
		stretch_direction = will_open ? "open" : "close";
		stretch_x = 1.1 + velocity * 0.08;
		stretch_y = 0.95 - velocity * 0.04;
		stretch_distance = 2.5 + velocity * 2.5;
		is_stretching = false;

		stretch_fiber?.interruptUnsafe();
		stretch_fiber = Effect.runFork(play_stretch_animation);
	}

	onDestroy(() => {
		stretch_fiber?.interruptUnsafe();
	});
</script>

<Button
	bind:ref
	data-sidebar="trigger"
	data-slot="sidebar-trigger"
	variant="ghost"
	size="icon-sm"
	class={cn("cn-sidebar-trigger t-velocity-stretch", class_name)}
	type="button"
	data-stretching={is_stretching}
	data-stretch-direction={stretch_direction}
	style={`--sidebar-stretch-x: ${stretch_x.toFixed(3)}; --sidebar-stretch-y: ${stretch_y.toFixed(3)}; --sidebar-stretch-distance: ${stretch_distance.toFixed(2)}px; ${style ?? ""}`}
	onclick={(event) => {
		onclick?.(event);
		replay_velocity_stretch();
		sidebar.toggle();
	}}
	{...rest_props}
>
	{#if children}
		{@render children()}
	{:else}
		<LayoutSidebar />
	{/if}
	<span class="sr-only">Toggle Sidebar</span>
</Button>
