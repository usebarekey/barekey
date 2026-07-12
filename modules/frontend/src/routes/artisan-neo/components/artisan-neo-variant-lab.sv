<script lang="ts" effect>
	import { Effect } from "effect";
	import neo_url from "$lib/assets/fonts/artisan-neo/artisan-neo-variable.woff2";
	import edge_url from "$lib/assets/fonts/artisan-neo/variants/artisan-neo-edge-variable.woff2";
	import grotesk_url from "$lib/assets/fonts/artisan-neo/variants/artisan-neo-grotesk-variable.woff2";
	import round_url from "$lib/assets/fonts/artisan-neo/variants/artisan-neo-round-variable.woff2";
	import soft_url from "$lib/assets/fonts/artisan-neo/variants/artisan-neo-soft-variable.woff2";
	import wink_url from "$lib/assets/fonts/artisan-neo/variants/artisan-neo-wink-variable.woff2";

	type Variant = {
		description: string;
		download_name: string;
		family_name: string;
		id: "neo" | "edge" | "soft" | "round" | "grotesk" | "wink";
		name: string;
		traits: string;
		url: string;
	};

	const variants = [
		{
			description: "The control: disciplined, open, and quiet enough for product UI.",
			download_name: "ArtisanNeo-Variable.woff2",
			family_name: "Artisan Neo",
			id: "neo",
			name: "Neo",
			traits: "balanced / precise / warm",
			url: neo_url,
		},
		{
			description: "Narrower bowls, firmer sides, and more decisive identity gestures.",
			download_name: "ArtisanNeoEdge-Variable.woff2",
			family_name: "Artisan Neo Edge",
			id: "edge",
			name: "Edge",
			traits: "taut / squared / decisive",
			url: edge_url,
		},
		{
			description: "Wider rounds and quieter terminals create a gentler reading texture.",
			download_name: "ArtisanNeoSoft-Variable.woff2",
			family_name: "Artisan Neo Soft",
			id: "soft",
			name: "Soft",
			traits: "open / relaxed / warm",
			url: soft_url,
		},
		{
			description: "Fuller bowls and circular details push the geometric side forward.",
			download_name: "ArtisanNeoRound-Variable.woff2",
			family_name: "Artisan Neo Round",
			id: "round",
			name: "Round",
			traits: "full / geometric / friendly",
			url: round_url,
		},
		{
			description: "Compressed forms and boxier curves produce a denser grotesk color.",
			download_name: "ArtisanNeoGrotesk-Variable.woff2",
			family_name: "Artisan Neo Grotesk",
			id: "grotesk",
			name: "Grotesk",
			traits: "narrow / boxy / industrial",
			url: grotesk_url,
		},
		{
			description: "The personality dial pushed furthest in a small set of recognition glyphs.",
			download_name: "ArtisanNeoWink-Variable.woff2",
			family_name: "Artisan Neo Wink",
			id: "wink",
			name: "Wink",
			traits: "lively / human / odd",
			url: wink_url,
		},
	] as const satisfies readonly Variant[];

	let specimen = $state("Quick agents craft warm tools.");
	let weight = $state(560);
	let optical_size = $state(28);
	let font_size = $state(68);
	let tracking = $state(-36);
	let selected = $state<Variant>(variants[0]);

	const SetSpecimen = (value: string) =>
		Effect.gen(function* () {
			specimen = value;
		});

	const SetWeight = (value: string) =>
		Effect.gen(function* () {
			weight = Number(value);
		});

	const SetOpticalSize = (value: string) =>
		Effect.gen(function* () {
			optical_size = Number(value);
		});

	const SetFontSize = (value: string) =>
		Effect.gen(function* () {
			font_size = Number(value);
		});

	const SetTracking = (value: string) =>
		Effect.gen(function* () {
			tracking = Number(value);
		});

	const SelectVariant = (variant: Variant) =>
		Effect.gen(function* () {
			selected = variant;
		});
</script>

<section
	class="variant-lab section-shell"
	aria-labelledby="variant-lab-title"
	style:--variant-weight={weight}
	style:--variant-opsz={optical_size}
	style:--variant-size={`${font_size}px`}
	style:--variant-tracking={`${tracking / 1000}em`}
>
	<div class="section-heading">
		<div>
			<p class="section-index">02 / Variant lab</p>
			<h2 id="variant-lab-title">Same bones. Different moods.</h2>
		</div>
		<p class="section-note">
			Five real outline experiments around Neo. Every proof shares the same axes and spacing.
		</p>
	</div>

	<div class="variant-controls">
		<label for="variant-specimen" class="specimen-input">
			<span>Shared specimen</span>
			<textarea
				id="variant-specimen"
				name="variant-specimen"
				rows="2"
				spellcheck="false"
				value={specimen}
				oninput={yield* SetSpecimen(event.currentTarget.value)}
			></textarea>
		</label>

		<div class="axis-controls">
			<label for="variant-weight">
				<span><b>Weight</b><output for="variant-weight">{weight}</output></span>
				<input
					id="variant-weight"
					name="variant-weight"
					type="range"
					min="100"
					max="900"
					step="1"
					value={weight}
					oninput={yield* SetWeight(event.currentTarget.value)}
				/>
			</label>
			<label for="variant-optical-size">
				<span><b>Optical size</b><output for="variant-optical-size">{optical_size}</output></span>
				<input
					id="variant-optical-size"
					name="variant-optical-size"
					type="range"
					min="14"
					max="32"
					step="1"
					value={optical_size}
					oninput={yield* SetOpticalSize(event.currentTarget.value)}
				/>
			</label>
			<label for="variant-font-size">
				<span><b>Size</b><output for="variant-font-size">{font_size}px</output></span>
				<input
					id="variant-font-size"
					name="variant-font-size"
					type="range"
					min="34"
					max="104"
					step="1"
					value={font_size}
					oninput={yield* SetFontSize(event.currentTarget.value)}
				/>
			</label>
			<label for="variant-tracking">
				<span><b>Tracking</b><output for="variant-tracking">{tracking}</output></span>
				<input
					id="variant-tracking"
					name="variant-tracking"
					type="range"
					min="-70"
					max="70"
					step="1"
					value={tracking}
					oninput={yield* SetTracking(event.currentTarget.value)}
				/>
			</label>
		</div>
	</div>

	<fieldset class="variant-list">
		<legend class="sr-only">Choose a focused Artisan Neo variant</legend>
		{#each variants as variant, index}
			<div class="variant-row" class:selected={selected.id === variant.id}>
				<div class="variant-meta">
					<label>
						<input
							type="radio"
							name="focused-variant"
							value={variant.id}
							checked={selected.id === variant.id}
							onchange={yield* SelectVariant(variant)}
						/>
						<span>{String(index + 1).padStart(2, "0")} / {variant.name}</span>
					</label>
					<p>{variant.traits}</p>
					<a href={variant.url} download={variant.download_name}>↓ WOFF2</a>
				</div>
				<div class="variant-proof variant--{variant.id}">
					<p>{specimen || "Type something worth making."}</p>
					<small aria-hidden="true">a e g r s · R Q &amp; @ · I l 1</small>
				</div>
			</div>
		{/each}
	</fieldset>

	<div class="focused-proof variant--{selected.id}">
		<div class="focused-heading">
			<p><span aria-live="polite">{selected.family_name}</span> / focused proof</p>
			<p>{selected.traits}</p>
		</div>
		<p class="focused-display">{specimen || "Type something worth making."}</p>
		<p class="focused-description">{selected.description}</p>
		<div class="focused-ui">
			<strong>Review changes</strong>
			<span>Agent Marina refined the type system</span>
			<small>Medium · 500 · 14px</small>
			<span class="action">Accept</span>
		</div>
	</div>
</section>

<style>
	.section-shell {
		width: min(100% - 40px, 1440px);
		margin-inline: auto;
		padding: 112px 0;
		border-top: 1px solid color-mix(in srgb, currentColor 18%, transparent);
	}

	.section-heading {
		display: flex;
		align-items: end;
		justify-content: space-between;
		gap: 32px;
		margin-bottom: 64px;
	}

	.section-heading h2 {
		margin-top: 12px;
		font-size: clamp(2.8rem, 5vw, 5.4rem);
		font-weight: 450;
		font-variation-settings: "wght" 450, "opsz" 32;
		line-height: 0.95;
		letter-spacing: -0.055em;
	}

	.section-index,
	.section-note {
		font-size: 11px;
		font-weight: 650;
		letter-spacing: 0.1em;
	}

	.section-index {
		text-transform: uppercase;
	}

	.section-note {
		max-width: 280px;
		line-height: 1.45;
		letter-spacing: 0.02em;
	}

	.variant-controls {
		display: grid;
		grid-template-columns: minmax(0, 1fr) minmax(360px, 0.8fr);
		border: 1px solid #171713;
	}

	.variant-controls > *,
	.variant-row > * {
		min-width: 0;
	}

	.specimen-input {
		padding: 22px;
		border-right: 1px solid color-mix(in srgb, currentColor 18%, transparent);
	}

	.specimen-input > span {
		display: block;
		margin-bottom: 18px;
		font-size: 11px;
		font-weight: 650;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.specimen-input textarea {
		width: 100%;
		padding: 0;
		border: 0;
		resize: none;
		background: transparent;
		color: inherit;
		font: 500 30px/1.05 "Artisan Neo", sans-serif;
		letter-spacing: -0.035em;
		outline: none;
	}

	.specimen-input textarea:focus-visible {
		outline: 2px solid currentColor;
		outline-offset: 8px;
	}

	.axis-controls {
		display: grid;
		grid-template-columns: 1fr 1fr;
	}

	.axis-controls label {
		padding: 18px;
		border-bottom: 1px solid color-mix(in srgb, currentColor 18%, transparent);
		border-left: 1px solid color-mix(in srgb, currentColor 18%, transparent);
	}

	.axis-controls label:nth-last-child(-n + 2) {
		border-bottom: 0;
	}

	.axis-controls label > span {
		display: flex;
		justify-content: space-between;
		margin-bottom: 14px;
		font-size: 11px;
	}

	.axis-controls b {
		font-weight: 650;
	}

	.axis-controls input {
		width: 100%;
		accent-color: currentColor;
	}

	.variant-list {
		margin: 32px 0 0;
		padding: 0;
		border: 0;
	}

	.variant-row {
		display: grid;
		grid-template-columns: 190px minmax(0, 1fr);
		border: 1px solid color-mix(in srgb, currentColor 20%, transparent);
		border-bottom: 0;
		background: rgb(255 255 255 / 18%);
	}

	.variant-row:last-child {
		border-bottom: 1px solid color-mix(in srgb, currentColor 20%, transparent);
	}

	.variant-row.selected {
		position: relative;
		z-index: 1;
		border-color: #171713;
		box-shadow: inset 4px 0 #171713;
	}

	.variant-meta {
		display: flex;
		flex-direction: column;
		justify-content: center;
		gap: 12px;
		padding: 22px;
		border-right: 1px solid color-mix(in srgb, currentColor 18%, transparent);
	}

	.variant-meta label {
		display: flex;
		align-items: center;
		gap: 9px;
		font-size: 12px;
		font-weight: 700;
		cursor: pointer;
	}

	.variant-meta input {
		width: 16px;
		height: 16px;
		accent-color: #171713;
	}

	.variant-meta p,
	.variant-meta a {
		font-size: 10px;
		line-height: 1.4;
	}

	.variant-meta p {
		letter-spacing: 0.06em;
		text-transform: uppercase;
	}

	.variant-meta a {
		width: fit-content;
		color: inherit;
		font-weight: 650;
		text-underline-offset: 3px;
	}

	.variant-proof {
		min-width: 0;
		padding: 28px 32px 24px;
		overflow: hidden;
	}

	.variant-proof p,
	.focused-display {
		font-size: clamp(2.25rem, var(--variant-size), 6.5rem);
		font-weight: var(--variant-weight);
		font-variation-settings: "wght" var(--variant-weight), "opsz" var(--variant-opsz);
		line-height: 0.92;
		letter-spacing: var(--variant-tracking);
		overflow-wrap: anywhere;
	}

	.variant-proof small {
		display: block;
		margin-top: 18px;
		font-size: 22px;
		font-weight: 500;
		font-variation-settings: "wght" 500, "opsz" 14;
		letter-spacing: 0;
	}

	.variant--neo {
		font-family: "Artisan Neo", sans-serif;
	}

	.variant--edge {
		font-family: "Artisan Neo Edge", sans-serif;
	}

	.variant--soft {
		font-family: "Artisan Neo Soft", sans-serif;
	}

	.variant--round {
		font-family: "Artisan Neo Round", sans-serif;
	}

	.variant--grotesk {
		font-family: "Artisan Neo Grotesk", sans-serif;
	}

	.variant--wink {
		font-family: "Artisan Neo Wink", sans-serif;
	}

	.focused-proof {
		margin-top: 80px;
		padding: 36px;
		border-radius: 18px;
		background: #151512;
		color: #f0eee8;
		box-shadow: 0 24px 60px rgb(23 23 19 / 16%);
	}

	.focused-heading {
		display: flex;
		justify-content: space-between;
		padding-bottom: 22px;
		border-bottom: 1px solid rgb(240 238 232 / 16%);
		font-size: 10px;
		font-weight: 650;
		letter-spacing: 0.08em;
		text-transform: uppercase;
	}

	.focused-display {
		max-width: 1100px;
		margin: 72px 0 32px;
	}

	.focused-description {
		max-width: 520px;
		color: #a8a69f;
		font-size: 14px;
		line-height: 1.45;
	}

	.focused-ui {
		display: grid;
		grid-template-columns: auto 1fr auto auto;
		align-items: center;
		gap: 20px;
		margin-top: 72px;
		padding: 18px 20px;
		border: 1px solid rgb(240 238 232 / 16%);
		border-radius: 12px;
		font-size: 13px;
		font-weight: 500;
		font-variation-settings: "wght" 500, "opsz" 14;
	}

	.focused-ui strong {
		font-weight: 650;
	}

	.focused-ui span,
	.focused-ui small {
		color: #8e8c85;
	}

	.focused-ui .action {
		display: grid;
		place-items: center;
		min-height: 36px;
		padding: 0 14px;
		border: 0;
		border-radius: 8px;
		background: #b6f36b;
		color: #151512;
		font: inherit;
		font-weight: 700;
	}

	@media (max-width: 800px) {
		.section-shell {
			width: min(100% - 28px, 1440px);
			padding: 80px 0;
		}

		.section-heading {
			align-items: start;
			flex-direction: column;
			margin-bottom: 40px;
		}

		.section-heading > *,
		.section-heading h2 {
			min-width: 0;
			overflow-wrap: anywhere;
		}

		.section-heading h2 {
			font-size: clamp(2.45rem, 12vw, 3.6rem);
		}

		.variant-controls,
		.variant-row {
			grid-template-columns: 1fr;
		}

		.specimen-input,
		.variant-meta {
			border-right: 0;
			border-bottom: 1px solid color-mix(in srgb, currentColor 18%, transparent);
		}

		.axis-controls label:nth-child(odd) {
			border-left: 0;
		}

		.variant-meta {
			align-items: center;
			flex-direction: row;
			justify-content: space-between;
			gap: 16px;
		}

		.variant-meta p {
			display: none;
		}

		.variant-proof {
			padding: 30px 22px;
		}

		.variant-proof p,
		.focused-display {
			font-size: min(var(--variant-size), 3rem);
		}

		.specimen-input textarea {
			font-size: 24px;
		}

		.focused-proof {
			margin-top: 56px;
			padding: 24px;
		}

		.focused-ui {
			grid-template-columns: 1fr auto;
		}

		.focused-ui span,
		.focused-ui small {
			display: none;
		}
	}

	@media (max-width: 520px) {
		.axis-controls {
			grid-template-columns: 1fr;
		}

		.axis-controls label,
		.axis-controls label:nth-last-child(-n + 2) {
			border-bottom: 1px solid color-mix(in srgb, currentColor 18%, transparent);
			border-left: 0;
		}

		.axis-controls label:last-child {
			border-bottom: 0;
		}

		.focused-heading {
			align-items: start;
			flex-direction: column;
			gap: 8px;
		}
	}
</style>
