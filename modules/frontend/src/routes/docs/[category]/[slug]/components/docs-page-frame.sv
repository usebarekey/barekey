<script lang="ts">
	import type { Snippet } from "svelte";
	import { MediaQuery } from "svelte/reactivity";
	import * as ScrollArea from "$lib/components/ui/scroll-area";
	import * as Sidebar from "$lib/components/ui/sidebar";
	import LayoutSidebar from "@tabler/icons-svelte/icons/layout-sidebar";

	let {
		article,
		sidebar,
		table_of_contents,
	}: {
		article: Snippet;
		sidebar: Snippet;
		table_of_contents: Snippet<[HTMLElement | null]>;
	} = $props();

	let article_viewport = $state<HTMLElement | null>(null);
	let compact_scroll_root = $state<HTMLElement | null>(null);
	const compact_layout = new MediaQuery("(max-width: 1279px)");
	const toc_scroll_root = $derived(
		compact_layout.current ? compact_scroll_root : article_viewport,
	);
</script>

<Sidebar.Provider
	mobile_breakpoint={1280}
	style="--sidebar-min-width: 14rem; --sidebar-max-width: 16rem; --sidebar-width: min(var(--sidebar-max-width), max(var(--sidebar-min-width), var(--docs-sidebar-natural-width, var(--sidebar-min-width)))); --sidebar-width-icon: 2.5rem;"
>
	<Sidebar.Root variant="inset" collapsible="icon">
		<div class="relative flex min-h-0 flex-1 flex-row">
			{@render sidebar()}
			<Sidebar.Trigger
				class="group/sidebar-toggle absolute right-2 top-2 hidden size-10 items-center justify-center rounded-full bg-foreground/5 card group-data-[collapsible=icon]:right-0 xl:flex"
			>
				<LayoutSidebar
					class="size-4 text-muted-foreground transition-colors duration-(--duration-fast) ease-in-out group-hover/sidebar-toggle:text-foreground motion-reduce:transition-none"
				/>
			</Sidebar.Trigger>
		</div>
	</Sidebar.Root>

	<div class="flex w-12 shrink-0 items-start justify-center py-2 xl:hidden">
		<Sidebar.Trigger
			aria-label="Open documentation navigation"
			class="group/sidebar-toggle flex size-10 items-center justify-center rounded-full bg-foreground/5 card"
		>
			<LayoutSidebar
				class="size-4 text-muted-foreground transition-colors duration-(--duration-fast) ease-in-out group-hover/sidebar-toggle:text-foreground motion-reduce:transition-none"
			/>
		</Sidebar.Trigger>
	</div>

	<Sidebar.Inset
		class="h-svh max-h-svh min-h-0 min-w-0 w-0 flex-1 py-2 pr-2 pl-0 xl:h-[calc(100svh-1rem)] xl:max-h-[calc(100svh-1rem)]"
	>
		<div
			bind:this={compact_scroll_root}
			class="docs-responsive-surfaces flex h-full min-h-0 flex-col items-stretch gap-2 overflow-y-auto overscroll-y-contain xl:flex-row xl:justify-between xl:overflow-hidden"
		>
			<ScrollArea.Root
				class="docs-toc-surface docs-scroll-fade order-first min-h-0 w-full shrink-0 rounded-2xl bg-linear-to-b from-foreground/5 to-foreground/2.5 p-1 card xl:order-last xl:h-full xl:w-[350px] xl:rounded-3xl"
				scrollbarYClasses="hidden"
			>
				{@render table_of_contents(toc_scroll_root)}
			</ScrollArea.Root>

			<ScrollArea.Root
				bind:viewportRef={article_viewport}
				class="docs-article-surface docs-scroll-fade order-last min-h-0 min-w-0 shrink-0 rounded-2xl bg-linear-to-b from-foreground/5 to-foreground/2.5 p-1 card xl:order-first xl:h-full xl:flex-1 xl:shrink xl:rounded-3xl"
				scrollbarYClasses="hidden"
			>
				{@render article()}
			</ScrollArea.Root>
		</div>
	</Sidebar.Inset>
</Sidebar.Provider>

<style>
	:global(.docs-scroll-fade [data-slot="scroll-area-viewport"]) {
		mask-image: linear-gradient(
			to bottom,
			transparent,
			black 16px,
			black calc(100% - 16px),
			transparent
		);
		-webkit-mask-image: linear-gradient(
			to bottom,
			transparent,
			black 16px,
			black calc(100% - 16px),
			transparent
		);
	}

	@media (max-width: 1279px) {
		:global(.docs-responsive-surfaces > [data-slot="scroll-area"]) {
			overflow: visible;
		}

		:global(.docs-responsive-surfaces > [data-slot="scroll-area"] > [data-slot="scroll-area-viewport"]) {
			display: block;
			height: auto;
			overflow: visible !important;
			mask-image: none;
			-webkit-mask-image: none;
		}

		:global(.docs-responsive-surfaces > [data-slot="scroll-area"] > [data-slot="scroll-area-scrollbar"]) {
			display: none;
		}
	}
</style>
