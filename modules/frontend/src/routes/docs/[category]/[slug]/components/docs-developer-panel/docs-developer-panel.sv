<script lang="ts" effect>
	import { Effect } from "effect";
	import AdjustmentsHorizontal from "@tabler/icons-svelte/icons/adjustments-horizontal";
	import X from "@tabler/icons-svelte/icons/x";
	import FontsSection from "./fonts-section.sv";

	let open = $state(false);
	let trigger: HTMLButtonElement;
	let close_button: HTMLButtonElement;

	const OpenPanel = Effect.gen(function* () {
		open = true;
		yield* Effect.sleep("0 millis");
		close_button.focus();
	});

	const ClosePanel = Effect.gen(function* () {
		open = false;
		yield* Effect.sleep("0 millis");
		trigger.focus();
	});

	const CloseOnEscape = (key: string) =>
		Effect.gen(function* () {
			if (open && key === "Escape") yield* ClosePanel;
		});
</script>

<svelte:window onkeydown={yield* CloseOnEscape(event.key)} />

<div class="developer-panel-anchor" data-open={open}>
	<aside
		id="docs-developer-panel"
		class="developer-panel card"
		aria-label="Developer controls"
		aria-hidden={!open}
		inert={!open}
	>
		<header>
			<div>
				<span>DEV</span>
				<strong>Playground</strong>
			</div>
			<button bind:this={close_button} type="button" aria-label="Close developer controls" onclick={yield* ClosePanel}>
				<X aria-hidden="true" />
			</button>
		</header>

		<div class="developer-panel-scroll">
			<FontsSection />
		</div>
	</aside>

	<button
		bind:this={trigger}
		type="button"
		class="developer-panel-trigger card"
		aria-label="Open developer controls"
		aria-expanded={open}
		aria-controls="docs-developer-panel"
		inert={open}
		onclick={yield* OpenPanel}
	>
		<AdjustmentsHorizontal aria-hidden="true" />
	</button>
</div>

<style>
	.developer-panel-anchor {
		position: fixed;
		top: max(0.5rem, env(safe-area-inset-top));
		right: max(0.5rem, env(safe-area-inset-right));
		z-index: 60;
		width: 2.5rem;
		height: 2.5rem;
		pointer-events: none;
	}

	.developer-panel-anchor[data-open="true"] {
		width: min(23.75rem, calc(100vw - 1rem));
		height: min(45rem, calc(100svh - max(1rem, env(safe-area-inset-top))));
	}

	.developer-panel,
	.developer-panel-trigger {
		position: absolute;
		top: 0;
		right: 0;
		background: color-mix(in oklab, var(--background) 92%, transparent);
		box-shadow: 0 1rem 3rem color-mix(in oklab, black 22%, transparent);
		backdrop-filter: blur(20px);
	}

	.developer-panel {
		display: flex;
		width: 100%;
		height: 100%;
		flex-direction: column;
		border-radius: 1.5rem;
		opacity: 0;
		overflow: hidden;
		pointer-events: none;
		transform: scale(0.12);
		transform-origin: top right;
		transition:
			opacity 120ms ease,
			transform var(--duration-fast) var(--ease-smooth-out);
	}

	[data-open="true"] .developer-panel {
		opacity: 1;
		pointer-events: auto;
		transform: scale(1);
		transition:
			opacity 100ms ease,
			transform var(--duration-medium) var(--ease-smooth-out);
	}

	.developer-panel > header {
		display: flex;
		min-height: 4.25rem;
		align-items: center;
		justify-content: space-between;
		padding: 0.75rem 0.875rem 0.75rem 1rem;
		border-bottom: 1px solid color-mix(in oklab, var(--foreground) 8%, transparent);
	}

	.developer-panel > header > div {
		display: grid;
		gap: 0.125rem;
	}

	.developer-panel > header span {
		width: fit-content;
		padding: 0.125rem 0.375rem;
		border-radius: 999px;
		background: color-mix(in oklab, var(--foreground) 8%, transparent);
		color: var(--muted-foreground);
		font-size: 0.625rem;
		font-weight: 700;
		letter-spacing: 0.08em;
	}

	.developer-panel > header strong {
		font-size: 1rem;
		font-weight: 650;
		letter-spacing: -0.035em;
	}

	.developer-panel > header button,
	.developer-panel-trigger {
		display: grid;
		width: 2.5rem;
		height: 2.5rem;
		place-items: center;
		border-radius: 999px;
		color: var(--muted-foreground);
		transition: color var(--duration-fast) ease, background var(--duration-fast) ease;
	}

	.developer-panel > header button:hover,
	.developer-panel-trigger:hover {
		background: color-mix(in oklab, var(--foreground) 7%, transparent);
		color: var(--foreground);
	}

	.developer-panel > header button:focus-visible,
	.developer-panel-trigger:focus-visible {
		outline: 2px solid var(--ring);
		outline-offset: 2px;
	}

	.developer-panel > header :global(svg),
	.developer-panel-trigger :global(svg) {
		width: 1rem;
		height: 1rem;
	}

	.developer-panel-trigger {
		z-index: 1;
		pointer-events: auto;
		transition:
			opacity 80ms ease 100ms,
			color var(--duration-fast) ease,
			background var(--duration-fast) ease;
	}

	[data-open="true"] .developer-panel-trigger {
		opacity: 0;
		pointer-events: none;
		transition: opacity 60ms ease;
	}

	.developer-panel-scroll {
		min-height: 0;
		flex: 1;
		overflow-y: auto;
		overscroll-behavior: contain;
		padding: 0.75rem;
	}

	@media (prefers-reduced-motion: reduce) {
		.developer-panel,
		.developer-panel-trigger,
		.developer-panel > header button {
			transition: none;
		}
	}
</style>
