<script lang="ts" effect>
	import { Effect } from "effect";
	import RotateClockwise from "@tabler/icons-svelte/icons/rotate-clockwise";
	import DocsDeveloperPanelSection from "./docs-developer-panel-section.sv";

	const style_properties = [
		"--docs-dev-heading-weight",
		"--docs-dev-heading-tracking",
		"--docs-dev-heading-scale",
		"--docs-dev-prose-weight",
		"--docs-dev-prose-tracking",
		"--docs-dev-prose-scale",
		"--docs-dev-logo-weight",
		"--docs-dev-logo-tracking",
		"--docs-dev-logo-size",
	] as const;
	const style_target_selector =
		'.docs-responsive-surfaces, .docs-sidebar-nav-surface, [data-slot="sidebar"]:has(.docs-sidebar-nav-surface)';
	const font_defaults = {
		heading_scale: 1,
		heading_tracking: -0.045,
		heading_weight: 630,
		logo_size: 24,
		logo_tracking: -0.05,
		logo_weight: 700,
		prose_scale: 1,
		prose_tracking: -0.04,
		prose_weight: 410,
	} as const;

	let heading_weight = $state<number>(font_defaults.heading_weight);
	let heading_tracking = $state<number>(font_defaults.heading_tracking);
	let heading_scale = $state<number>(font_defaults.heading_scale);
	let prose_weight = $state<number>(font_defaults.prose_weight);
	let prose_tracking = $state<number>(font_defaults.prose_tracking);
	let prose_scale = $state<number>(font_defaults.prose_scale);
	let logo_weight = $state<number>(font_defaults.logo_weight);
	let logo_tracking = $state<number>(font_defaults.logo_tracking);
	let logo_size = $state<number>(font_defaults.logo_size);

	const SetStyleProperty = (property: (typeof style_properties)[number], value: string) =>
		Effect.gen(function* () {
			yield* Effect.sync(() => {
				for (const target of document.querySelectorAll<HTMLElement>(style_target_selector)) {
					target.style.setProperty(property, value);
				}
			});
		});

	const SetHeadingWeight = (value: string) =>
		Effect.gen(function* () {
			heading_weight = Number(value);
			yield* SetStyleProperty("--docs-dev-heading-weight", heading_weight.toString());
		});
	const SetHeadingTracking = (value: string) =>
		Effect.gen(function* () {
			heading_tracking = Number(value);
			yield* SetStyleProperty("--docs-dev-heading-tracking", `${heading_tracking}em`);
		});
	const SetHeadingScale = (value: string) =>
		Effect.gen(function* () {
			heading_scale = Number(value) / 100;
			yield* SetStyleProperty("--docs-dev-heading-scale", heading_scale.toString());
		});
	const SetProseWeight = (value: string) =>
		Effect.gen(function* () {
			prose_weight = Number(value);
			yield* SetStyleProperty("--docs-dev-prose-weight", prose_weight.toString());
		});
	const SetProseTracking = (value: string) =>
		Effect.gen(function* () {
			prose_tracking = Number(value);
			yield* SetStyleProperty("--docs-dev-prose-tracking", `${prose_tracking}em`);
		});
	const SetProseScale = (value: string) =>
		Effect.gen(function* () {
			prose_scale = Number(value) / 100;
			yield* SetStyleProperty("--docs-dev-prose-scale", prose_scale.toString());
		});
	const SetLogoWeight = (value: string) =>
		Effect.gen(function* () {
			logo_weight = Number(value);
			yield* SetStyleProperty("--docs-dev-logo-weight", logo_weight.toString());
		});
	const SetLogoTracking = (value: string) =>
		Effect.gen(function* () {
			logo_tracking = Number(value);
			yield* SetStyleProperty("--docs-dev-logo-tracking", `${logo_tracking}em`);
		});
	const SetLogoSize = (value: string) =>
		Effect.gen(function* () {
			logo_size = Number(value);
			yield* SetStyleProperty("--docs-dev-logo-size", `${logo_size}px`);
		});

	const ResetFonts = Effect.gen(function* () {
		heading_weight = font_defaults.heading_weight;
		heading_tracking = font_defaults.heading_tracking;
		heading_scale = font_defaults.heading_scale;
		prose_weight = font_defaults.prose_weight;
		prose_tracking = font_defaults.prose_tracking;
		prose_scale = font_defaults.prose_scale;
		logo_weight = font_defaults.logo_weight;
		logo_tracking = font_defaults.logo_tracking;
		logo_size = font_defaults.logo_size;

		yield* Effect.sync(() => {
			for (const target of document.querySelectorAll<HTMLElement>(style_target_selector)) {
				for (const property of style_properties) target.style.removeProperty(property);
			}
		});
	});
</script>

<DocsDeveloperPanelSection
	id="docs-dev-fonts"
	title="Fonts"
	description="Headers, prose and logo"
	initially_open
>
	<div class="font-controls">
		<fieldset>
			<legend>Headers</legend>
			<label>
				<span>Weight <output>{heading_weight}</output></span>
				<input type="range" min="100" max="900" step="10" value={heading_weight} oninput={yield* SetHeadingWeight(event.currentTarget.value)} />
			</label>
			<label>
				<span>Tracking <output>{heading_tracking.toFixed(3)}em</output></span>
				<input type="range" min="-0.1" max="0.02" step="0.005" value={heading_tracking} oninput={yield* SetHeadingTracking(event.currentTarget.value)} />
			</label>
			<label>
				<span>Size <output>{Math.round(heading_scale * 100)}%</output></span>
				<input type="range" min="75" max="150" step="1" value={heading_scale * 100} oninput={yield* SetHeadingScale(event.currentTarget.value)} />
			</label>
		</fieldset>

		<fieldset>
			<legend>Prose / text</legend>
			<label>
				<span>Weight <output>{prose_weight}</output></span>
				<input type="range" min="100" max="900" step="10" value={prose_weight} oninput={yield* SetProseWeight(event.currentTarget.value)} />
			</label>
			<label>
				<span>Tracking <output>{prose_tracking.toFixed(3)}em</output></span>
				<input type="range" min="-0.1" max="0.02" step="0.005" value={prose_tracking} oninput={yield* SetProseTracking(event.currentTarget.value)} />
			</label>
			<label>
				<span>Size <output>{Math.round(prose_scale * 100)}%</output></span>
				<input type="range" min="80" max="140" step="1" value={prose_scale * 100} oninput={yield* SetProseScale(event.currentTarget.value)} />
			</label>
		</fieldset>

		<fieldset>
			<legend>Logo</legend>
			<label>
				<span>Weight <output>{logo_weight}</output></span>
				<input type="range" min="100" max="900" step="10" value={logo_weight} oninput={yield* SetLogoWeight(event.currentTarget.value)} />
			</label>
			<label>
				<span>Tracking <output>{logo_tracking.toFixed(3)}em</output></span>
				<input type="range" min="-0.1" max="0.02" step="0.005" value={logo_tracking} oninput={yield* SetLogoTracking(event.currentTarget.value)} />
			</label>
			<label>
				<span>Size <output>{logo_size}px</output></span>
				<input type="range" min="16" max="40" step="1" value={logo_size} oninput={yield* SetLogoSize(event.currentTarget.value)} />
			</label>
		</fieldset>

		<button type="button" class="reset-button" onclick={yield* ResetFonts}>
			<RotateClockwise aria-hidden="true" />
			Reset font settings
		</button>
	</div>
</DocsDeveloperPanelSection>

<style>
	.font-controls { display: grid; gap: 0.875rem; }
	fieldset { display: grid; gap: 0.625rem; border: 0; padding: 0; }
	legend { margin-bottom: 0.125rem; color: var(--foreground); font-size: 0.75rem; font-weight: 650; letter-spacing: -0.02em; }
	label { display: grid; gap: 0.375rem; }
	label > span { display: flex; justify-content: space-between; color: var(--muted-foreground); font-size: 0.6875rem; }
	output { color: var(--foreground); font-variant-numeric: tabular-nums; }
	input[type="range"] { width: 100%; accent-color: var(--foreground); cursor: ew-resize; }
	.reset-button { display: flex; min-height: 2.25rem; align-items: center; justify-content: center; gap: 0.5rem; border: 1px solid color-mix(in oklab, var(--foreground) 12%, transparent); border-radius: 0.75rem; color: var(--muted-foreground); font-size: 0.75rem; transition: color var(--duration-fast) ease, background var(--duration-fast) ease; }
	.reset-button:hover { background: color-mix(in oklab, var(--foreground) 5%, transparent); color: var(--foreground); }
	.reset-button:focus-visible { outline: 2px solid var(--ring); outline-offset: 2px; }
	.reset-button :global(svg) { width: 0.875rem; height: 0.875rem; }
	@media (prefers-reduced-motion: reduce) { .reset-button { transition: none; } }
</style>
