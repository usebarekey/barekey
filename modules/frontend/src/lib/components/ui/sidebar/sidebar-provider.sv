<script lang="ts">
	import * as Tooltip from "$lib/components/ui/tooltip/index.js";
	import { cn, type WithElementRef } from "$lib/utils.js";
	import { Effect } from "effect";
	import type { HTMLAttributes } from "svelte/elements";
	import {
		sidebar_cookie_max_age,
		sidebar_cookie_name,
		sidebar_width,
		sidebar_width_icon,
	} from "./constants.js";
	import { set_sidebar } from "./context.svelte.js";

	let {
		ref = $bindable(null),
		open = $bindable(true),
		onOpenChange: on_open_change = () => {},
		class: class_name,
		style,
		children,
		...rest_props
	}: WithElementRef<HTMLAttributes<HTMLDivElement>> & {
		open?: boolean;
		onOpenChange?: (open: boolean) => void;
	} = $props();

	const sidebar = set_sidebar({
		open: () => open,
		set_open: (value: boolean) => {
			open = value;
			on_open_change(value);

			Effect.runSync(
				Effect.sync(() => {
					document.cookie = `${sidebar_cookie_name}=${open}; path=/; max-age=${sidebar_cookie_max_age}`;
				})
			);
		},
	});
</script>

<svelte:window onkeydown={sidebar.handle_shortcut_keydown} />

<Tooltip.Provider delayDuration={0}>
	<div
		data-slot="sidebar-wrapper"
		style="--sidebar-width: {sidebar_width}; --sidebar-width-icon: {sidebar_width_icon}; {style}"
		class={cn(
			"group/sidebar-wrapper has-data-[variant=inset]:bg-background flex min-h-svh w-full",
			class_name
		)}
		bind:this={ref}
		{...rest_props}
	>
		{@render children?.()}
	</div>
</Tooltip.Provider>
