<script lang="ts">
	import { untrack, type Snippet } from "svelte";

	import ChevronDown from "@tabler/icons-svelte/icons/chevron-down";
	import CollapsibleContent from "$lib/components/ui/collapsible/collapsible-content.sv";
	import CollapsibleRoot from "$lib/components/ui/collapsible/collapsible.sv";
	import CollapsibleTrigger from "$lib/components/ui/collapsible/collapsible-trigger.sv";

	let {
		active_href,
		children,
		collapsible = false,
		gap,
		label_style,
		name,
		on_pointer_enter,
		on_state_change,
		on_state_change_complete,
	}: {
		active_href?: string;
		children: Snippet;
		collapsible?: boolean;
		gap: "none" | "group";
		label_style: string;
		name?: string;
		on_pointer_enter: (event: PointerEvent) => void;
		on_state_change: () => void;
		on_state_change_complete: () => void;
	} = $props();

	const can_collapse = $derived(collapsible && Boolean(name));

	let last_active_href = untrack(() => active_href);
	let open = $state(untrack(() => Boolean(active_href)));

	const handle_open_change = (next_open: boolean) => {
		open = next_open;
		on_state_change();
	};

	$effect(() => {
		const next_active_href = active_href;

		if (next_active_href && next_active_href !== last_active_href) {
			open = true;
		}

		last_active_href = next_active_href;
	});
</script>

{#if can_collapse}
	<li class="docs-sidebar-nav-entry-group">
		<CollapsibleRoot
			class="t-acc"
			{open}
			onOpenChange={handle_open_change}
			onOpenChangeComplete={on_state_change_complete}
		>
			<CollapsibleTrigger
				class="docs-sidebar-nav-disclosure docs-sidebar-nav-group-label t-sidebar-child t-acc-head relative z-10 flex h-7 w-full items-center rounded-full px-2.5 font-heading text-sm font-semibold outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
				data-gap={gap}
				onpointerenter={on_pointer_enter}
				style={label_style}
			>
				<span class="docs-sidebar-nav-group-label-text whitespace-nowrap">{name}</span>
				<ChevronDown aria-hidden="true" class="t-acc-chevron ml-auto size-4 text-muted-foreground" />
			</CollapsibleTrigger>

			<CollapsibleContent
				forceMount
				hiddenUntilFound={false}
				class="t-acc-panel"
				aria-hidden={!open}
				inert={!open}
			>
				<div class="t-acc-panel-inner">
					<ul class="flex min-w-0 flex-col">
						{@render children()}
					</ul>
				</div>
			</CollapsibleContent>
		</CollapsibleRoot>
	</li>
{:else}
	{#if name}
		<li
			class="docs-sidebar-nav-group-label t-sidebar-child relative z-10 flex h-5 items-center px-2.5 font-heading text-xs font-semibold text-foreground"
			data-gap={gap}
			style={label_style}
		>
			<span class="docs-sidebar-nav-group-label-text whitespace-nowrap">{name}</span>
		</li>
	{/if}

	{@render children()}
{/if}
