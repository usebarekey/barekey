<script lang="ts" effect>
	import { Effect } from "effect";
	import type { Snippet } from "svelte";
	import ChevronDown from "@tabler/icons-svelte/icons/chevron-down";

	let {
		children,
		description,
		id,
		initially_open = false,
		title,
	}: {
		children: Snippet;
		description?: string;
		id: string;
		initially_open?: boolean;
		title: string;
	} = $props();

	let open = $state(false);

	yield* Effect.gen(function* () {
		open = initially_open;
	});

	const ToggleSection = Effect.gen(function* () {
		open = !open;
	});
</script>

<section class="developer-section" data-open={open}>
	<button
		type="button"
		class="section-trigger"
		aria-expanded={open}
		aria-controls={`${id}-panel`}
		onclick={yield* ToggleSection}
	>
		<span>
			<strong>{title}</strong>
			{#if description}<small>{description}</small>{/if}
		</span>
		<ChevronDown aria-hidden="true" class="chevron" />
	</button>

	<div class="section-reveal" id={`${id}-panel`} inert={!open}>
		<div class="section-reveal-inner">
			<div class="section-content">{@render children()}</div>
		</div>
	</div>
</section>

<style>
	.developer-section {
		border: 1px solid color-mix(in oklab, var(--foreground) 10%, transparent);
		border-radius: 1rem;
		background: color-mix(in oklab, var(--background) 70%, transparent);
		overflow: clip;
	}

	.section-trigger {
		display: flex;
		width: 100%;
		min-height: 3.375rem;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		padding: 0.75rem 0.875rem;
		color: var(--foreground);
		text-align: left;
	}

	.section-trigger > span {
		display: grid;
		gap: 0.125rem;
	}

	.section-trigger strong {
		font-size: 0.875rem;
		font-weight: 600;
		letter-spacing: -0.025em;
	}

	.section-trigger small {
		color: var(--muted-foreground);
		font-size: 0.75rem;
	}

	:global(.chevron) {
		width: 1rem;
		height: 1rem;
		flex: none;
		color: var(--muted-foreground);
		transition: transform var(--duration-fast) var(--ease-smooth-out);
	}

	[data-open="true"] :global(.chevron) {
		transform: scaleY(-1);
	}

	.section-reveal {
		display: grid;
		grid-template-rows: 0fr;
		transition: grid-template-rows var(--duration-medium) var(--ease-smooth-out);
	}

	[data-open="true"] .section-reveal {
		grid-template-rows: 1fr;
	}

	.section-reveal-inner {
		min-height: 0;
		overflow: hidden;
	}

	.section-content {
		padding: 0 0.875rem 0.875rem;
	}

	.section-trigger:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: -2px;
	}

	@media (prefers-reduced-motion: reduce) {
		:global(.chevron),
		.section-reveal {
			transition: none;
		}
	}
</style>
