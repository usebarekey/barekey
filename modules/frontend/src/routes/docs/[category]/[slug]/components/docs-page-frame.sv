<script lang="ts">
	import type { Snippet } from "svelte";
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
</script>

<Sidebar.Provider
	style="--sidebar-min-width: 14rem; --sidebar-max-width: 16rem; --sidebar-width: min(var(--sidebar-max-width), max(var(--sidebar-min-width), var(--docs-sidebar-natural-width, var(--sidebar-min-width)))); --sidebar-width-icon: 2.5rem;"
>
	<Sidebar.Root variant="inset" collapsible="icon">
		<div class="relative flex min-h-0 flex-1 flex-row">
			{@render sidebar()}
			<Sidebar.Trigger
				class="group/sidebar-toggle absolute right-2 top-2 flex size-10 items-center justify-center rounded-full bg-foreground/5 card group-data-[collapsible=icon]:right-0"
			>
				<LayoutSidebar
					class="size-4 text-muted-foreground transition-colors duration-(--duration-fast) ease-in-out group-hover/sidebar-toggle:text-foreground motion-reduce:transition-none"
				/>
			</Sidebar.Trigger>
		</div>
	</Sidebar.Root>

	<Sidebar.Inset
		class="h-[calc(100svh-1rem)] max-h-[calc(100svh-1rem)] min-h-0 py-2 pr-2 pl-0"
	>
		<div class="flex h-full min-h-0 flex-row items-stretch justify-between gap-2">
			<ScrollArea.Root
				bind:viewportRef={article_viewport}
				class="docs-scroll-fade h-full min-h-0 min-w-0 grow rounded-3xl bg-linear-to-b from-foreground/5 to-foreground/2.5 p-1 card"
				scrollbarYClasses="hidden"
			>
				{@render article()}
			</ScrollArea.Root>

			<ScrollArea.Root
				class="docs-scroll-fade h-full min-h-0 w-[350px] flex-none rounded-3xl bg-linear-to-b from-foreground/5 to-foreground/2.5 p-1 card"
				scrollbarYClasses="hidden"
			>
				{@render table_of_contents(article_viewport)}
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
</style>
