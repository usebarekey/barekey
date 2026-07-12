<script lang="ts">
	import { Effect } from "effect";
	import { tick, type Snippet } from "svelte";
	import { MediaQuery } from "svelte/reactivity";
	import * as ScrollArea from "$lib/components/ui/scroll-area";
	import * as Sidebar from "$lib/components/ui/sidebar";
	import DocsMobileHeader from "./docs-mobile-header.sv";
	import LayoutSidebar from "@tabler/icons-svelte/icons/layout-sidebar";

	let {
		article,
		page_key,
		sidebar,
		table_of_contents,
	}: {
		article: Snippet;
		page_key: string;
		sidebar: Snippet;
		table_of_contents: Snippet<[HTMLElement | null]>;
	} = $props();

	let article_viewport = $state<HTMLElement | null>(null);
	const compact_layout = new MediaQuery("(max-width: 1279px)");

	$effect(() => {
		void page_key;

		const reset_fiber = Effect.runFork(
			Effect.promise(tick).pipe(
				Effect.andThen(
					Effect.sync(() => {
						if (compact_layout.current) {
							window.scrollTo({ top: 0 });
						}

						article_viewport?.scrollTo({ top: 0 });
					}),
				),
			),
		);

		return () => reset_fiber.interruptUnsafe();
	});
</script>

<Sidebar.Provider
	mobile_breakpoint={1280}
	style="--sidebar-width: 16rem; --sidebar-width-icon: 2.5rem;"
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

	<Sidebar.Inset
		class="min-h-dvh min-w-0 w-0 flex-1 p-2 xl:h-[calc(100dvh-1rem)] xl:min-h-0 xl:max-h-[calc(100dvh-1rem)] xl:peer-data-[collapsible=icon]:pl-0"
		style="padding-bottom: max(0.5rem, env(safe-area-inset-bottom));"
	>
		{#if compact_layout.current}
			<div class="docs-responsive-surfaces flex flex-col items-stretch gap-2">
				<DocsMobileHeader />

				<section
					class="docs-toc-surface order-first w-full rounded-2xl bg-linear-to-b from-foreground/5 to-foreground/2.5 p-1 card"
				>
					<div class="overflow-hidden rounded-[calc(var(--radius-2xl)-0.25rem)]">
						{@render table_of_contents(null)}
					</div>
				</section>

				<article
					class="docs-article-surface order-last min-w-0 rounded-2xl bg-linear-to-b from-foreground/5 to-foreground/2.5 p-1 card"
				>
					<div class="overflow-hidden rounded-[calc(var(--radius-2xl)-0.25rem)]">
						{@render article()}
					</div>
				</article>
			</div>
		{:else}
			<div class="docs-responsive-surfaces flex h-full min-h-0 flex-row items-stretch justify-between gap-2 overflow-visible">
				<ScrollArea.Root
					bind:viewportRef={article_viewport}
					class="docs-article-surface docs-scroll-fade order-first h-full min-h-0 min-w-0 flex-1 rounded-3xl bg-linear-to-b from-foreground/5 to-foreground/2.5 p-1 card"
					scrollbarYClasses="hidden"
				>
					{@render article()}
				</ScrollArea.Root>

				<ScrollArea.Root
					class="docs-toc-surface docs-scroll-fade order-last h-full min-h-0 w-[350px] shrink-0 rounded-3xl bg-linear-to-b from-foreground/5 to-foreground/2.5 p-1 card"
					scrollbarYClasses="hidden"
				>
					{@render table_of_contents(article_viewport)}
				</ScrollArea.Root>
			</div>
		{/if}
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

	:global(.docs-scroll-fade > [data-slot="scroll-area-viewport"]) {
		border-radius: calc(var(--radius-3xl) - 0.25rem);
	}
</style>
