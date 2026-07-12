<script lang="ts" effect>
	import { Effect } from "effect";
	import artisan_font_url from "$lib/assets/fonts/artisan-neo/artisan-neo-variable.woff2";
	import artisan_ttf_url from "$lib/assets/fonts/artisan-neo/artisan-neo-variable.ttf";
	import license_url from "$lib/assets/fonts/artisan-neo/OFL.txt?url";
	import ArtisanNeoVariantLab from "./artisan-neo-variant-lab.sv";

	const weight_steps = [
		{ label: "Thin", weight: 100 },
		{ label: "ExtraLight", weight: 200 },
		{ label: "Light", weight: 300 },
		{ label: "Regular", weight: 400 },
		{ label: "Medium", weight: 500 },
		{ label: "SemiBold", weight: 600 },
		{ label: "Bold", weight: 700 },
		{ label: "ExtraBold", weight: 800 },
		{ label: "Black", weight: 900 },
	] as const;
	const feature_glyphs = ["R", "Q", "g", "r", "&", "@"] as const;
	const presets = [
		{ label: "Airy", weight: 260, optical_size: 14, font_size: 80, tracking: -18 },
		{ label: "Editorial", weight: 440, optical_size: 22, font_size: 72, tracking: -30 },
		{ label: "Display", weight: 720, optical_size: 32, font_size: 88, tracking: -42 },
	] as const;

	let weight = $state(440);
	let optical_size = $state(22);
	let font_size = $state(72);
	let tracking = $state(-30);

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

	const ApplyPreset = (preset: (typeof presets)[number]) =>
		Effect.gen(function* () {
			weight = preset.weight;
			optical_size = preset.optical_size;
			font_size = preset.font_size;
			tracking = preset.tracking;
		});
</script>

<svelte:head>
	<title>Artisan Neo · Variable typeface</title>
	<meta
		name="description"
		content="Explore Artisan Neo, a warm variable neo-grotesk made for sharp tools and human interfaces."
	/>
	<link rel="preload" href={artisan_font_url} as="font" type="font/woff2" crossorigin="anonymous" />
</svelte:head>

<main class="artisan-page">
	<header class="site-header">
		<a href="/" class="back-link" aria-label="Back to Barekey home">← Barekey</a>
		<div class="header-mark" aria-label="Artisan Neo version 0.1">
			<span class="status-dot"></span>
			Artisan Neo / 0.1
		</div>
		<a href={artisan_font_url} download="ArtisanNeo-Variable.woff2" class="download-link">
			Download font ↓
		</a>
	</header>

	<section class="hero" aria-labelledby="hero-title">
		<div class="eyebrow-row">
			<p>Variable neo-grotesk</p>
			<p>Weight 100—900 · Optical size 14—32</p>
		</div>
		<h1 id="hero-title">Sharp tools,<br /><em>warm hands.</em></h1>
		<div class="hero-footer">
			<p>
				A precise sans for interfaces that still want to feel made by people. Rational structure,
				open counters, and a small streak of character.
			</p>
			<p class="hero-glyphs" aria-hidden="true">Rg&Q</p>
		</div>
	</section>

	<section class="type-lab section-shell" aria-labelledby="type-lab-title">
		<div class="section-heading">
			<div>
				<p class="section-index">01 / Type lab</p>
				<h2 id="type-lab-title">Make it yours.</h2>
			</div>
			<div class="presets" aria-label="Type presets">
				{#each presets as preset}
					<button type="button" onclick={yield* ApplyPreset(preset)}>{preset.label}</button>
				{/each}
			</div>
		</div>

		<div
			class="live-specimen"
			style:--showcase-weight={weight}
			style:--showcase-opsz={optical_size}
			style:--showcase-size={`${font_size}px`}
			style:--showcase-tracking={`${tracking / 1000}em`}
		>
			<label for="specimen-text" class="sr-only">Editable type specimen</label>
			<textarea id="specimen-text" name="specimen-text" rows="3" spellcheck="false"
				>Readable systems should still feel human.</textarea
			>
		</div>

		<div class="control-grid">
			<label for="weight-axis">
				<span><b>Weight</b><output for="weight-axis">{weight}</output></span>
				<input
					id="weight-axis"
					name="weight-axis"
					type="range"
					min="100"
					max="900"
					step="1"
					value={weight}
					oninput={yield* SetWeight(event.currentTarget.value)}
				/>
			</label>
			<label for="optical-size-axis">
				<span><b>Optical size</b><output for="optical-size-axis">{optical_size}</output></span>
				<input
					id="optical-size-axis"
					name="optical-size-axis"
					type="range"
					min="14"
					max="32"
					step="1"
					value={optical_size}
					oninput={yield* SetOpticalSize(event.currentTarget.value)}
				/>
			</label>
			<label for="font-size-control">
				<span><b>Size</b><output for="font-size-control">{font_size}px</output></span>
				<input
					id="font-size-control"
					name="font-size-control"
					type="range"
					min="32"
					max="112"
					step="1"
					value={font_size}
					oninput={yield* SetFontSize(event.currentTarget.value)}
				/>
			</label>
			<label for="tracking-control">
				<span><b>Tracking</b><output for="tracking-control">{tracking}</output></span>
				<input
					id="tracking-control"
					name="tracking-control"
					type="range"
					min="-60"
					max="80"
					step="1"
					value={tracking}
					oninput={yield* SetTracking(event.currentTarget.value)}
				/>
			</label>
		</div>
	</section>

	<ArtisanNeoVariantLab />

	<section class="weight-section section-shell" aria-labelledby="weights-title">
		<div class="section-heading">
			<div>
				<p class="section-index">03 / Weight</p>
				<h2 id="weights-title">One voice, nine volumes.</h2>
			</div>
			<p class="section-note">Continuous variation, shown here at hundred-step intervals.</p>
		</div>
		<div class="weight-list">
			{#each weight_steps as step}
				<div class="weight-row" style:--row-weight={step.weight}>
					<span>{step.weight}</span>
					<p>Build with care.</p>
					<small>{step.label}</small>
				</div>
			{/each}
		</div>
	</section>

	<section class="optical-section section-shell" aria-labelledby="optical-title">
		<div class="section-heading">
			<div>
				<p class="section-index">04 / Optical size</p>
				<h2 id="optical-title">Designed for distance.</h2>
			</div>
		</div>
		<div class="optical-grid">
			<article class="optical-card text-cut">
				<header><span>Text / 14</span><span>18px</span></header>
				<p>
					Good tools reduce friction without erasing the maker. Artisan Neo keeps small text open,
					steady, and easy to scan across long working sessions.
				</p>
			</article>
			<article class="optical-card display-cut">
				<header><span>Display / 32</span><span>64px</span></header>
				<p>Quietly<br />confident.</p>
			</article>
		</div>
	</section>

	<section class="characters section-shell" aria-labelledby="characters-title">
		<div class="section-heading">
			<div>
				<p class="section-index">05 / Character</p>
				<h2 id="characters-title">Disciplined, with a wink.</h2>
			</div>
			<p class="section-note">A small set of gestures carries the personality.</p>
		</div>
		<div class="glyph-grid" aria-label="Artisan Neo feature glyphs">
			{#each feature_glyphs as glyph}
				<div><span>{glyph}</span><small>{glyph}</small></div>
			{/each}
		</div>
		<div class="alphabet-specimen" aria-label="Artisan Neo character repertoire">
			<p>ABCDEFGHIJKLMNOPQRSTUVWXYZ</p>
			<p>abcdefghijklmnopqrstuvwxyz</p>
			<p>0123456789 ¼ ½ ¾</p>
			<p>À Á Â Ä Å Æ Ç È É Ê Ë Ñ Ö Ø Œ Ü ß</p>
			<p>.,:;!?¿¡ “ ” ‘ ’ @ # $ € £ ¥ &amp; * + − = / &#92; ( ) [ ] &#123; &#125;</p>
		</div>
		<div class="legibility-strip">
			<p><span>I</span><span>l</span><span>1</span></p>
			<p><span>O</span><span>0</span></p>
			<p><span>rn</span><span>m</span></p>
			<small>Recognition pairs / work in progress</small>
		</div>
	</section>

	<section class="application section-shell" aria-labelledby="application-title">
		<div class="section-heading">
			<div>
				<p class="section-index">06 / In use</p>
				<h2 id="application-title">Made for working surfaces.</h2>
			</div>
		</div>
		<div class="app-window">
			<aside>
				<div class="window-controls"><i></i><i></i><i></i></div>
				<p class="app-kicker">Projects</p>
				<strong>Artisan Editor</strong>
				<nav aria-label="Application preview">
					<a href="#application-title" class="active"><span>01</span> New type system</a>
					<a href="#type-lab-title"><span>02</span> Review changes</a>
					<a href="#characters-title"><span>03</span> Design tokens</a>
				</nav>
			</aside>
			<div class="app-content">
				<header><span>New type system</span><small>Medium · 500</small></header>
				<div class="conversation">
					<p class="app-kicker">Current task</p>
					<h3>Give the interface a voice that feels precise, but never sterile.</h3>
					<div class="agent-row"><i>A</i><span>Artisan is refining the character set</span><b>Working</b></div>
					<div class="progress"><span></span></div>
				</div>
				<footer><span>Ask Artisan to make a change…</span><kbd>↵</kbd></footer>
			</div>
		</div>
	</section>

	<footer class="page-footer section-shell">
		<div>
			<p class="section-index">Artisan Neo / Variable prototype 0.1</p>
			<p class="footer-display">A typeface for<br />sharp tools and <em>warm hands.</em></p>
		</div>
		<div class="footer-meta">
			<p>
				Artisan Neo is an early, OFL-licensed derivative of Inter 4.1. It is ready for product
				prototyping while its most distinctive letterforms continue to evolve.
			</p>
			<div>
				<a href={artisan_font_url} download="ArtisanNeo-Variable.woff2">Download WOFF2</a>
				<a href={artisan_ttf_url} download="ArtisanNeo-Variable.ttf">Download TTF</a>
				<a href={license_url}>Read OFL 1.1</a>
			</div>
		</div>
	</footer>
</main>

<style>
	.artisan-page {
		--ink: #171713;
		--paper: #f0eee8;
		--line: color-mix(in srgb, var(--ink) 18%, transparent);
		--acid: #b6f36b;
		min-height: 100vh;
		min-width: 0;
		overflow-x: clip;
		color: var(--ink);
		background:
			linear-gradient(90deg, transparent calc(50% - 0.5px), rgb(23 23 19 / 4%) 50%, transparent calc(50% + 0.5px)),
			var(--paper);
		font-family: "Artisan Neo", sans-serif;
		font-optical-sizing: auto;
		font-synthesis: none;
	}

	.site-header,
	.section-shell,
	.hero {
		width: min(100% - 40px, 1440px);
		margin-inline: auto;
	}

	.site-header {
		display: grid;
		grid-template-columns: 1fr auto 1fr;
		align-items: center;
		min-height: 72px;
		border-bottom: 1px solid var(--line);
		font-size: 13px;
		font-weight: 600;
		letter-spacing: -0.01em;
	}

	.site-header a {
		color: inherit;
		text-decoration: none;
	}

	.header-mark {
		display: flex;
		align-items: center;
		gap: 8px;
		font-variant-numeric: tabular-nums;
	}

	.status-dot {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: var(--acid);
		box-shadow: 0 0 0 4px rgb(182 243 107 / 22%);
	}

	.download-link {
		justify-self: end;
	}

	.hero {
		padding: 40px 0 64px;
		min-height: min(820px, calc(100vh - 72px));
		display: flex;
		flex-direction: column;
		justify-content: space-between;
	}

	.eyebrow-row,
	.hero-footer,
	.section-heading {
		display: flex;
		justify-content: space-between;
		gap: 32px;
	}

	.eyebrow-row {
		font-size: 12px;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.hero h1 {
		margin: 48px 0;
		font-size: clamp(5rem, 13.5vw, 13rem);
		font-weight: 560;
		font-variation-settings: "wght" 560, "opsz" 32;
		line-height: 0.78;
		letter-spacing: -0.075em;
	}

	.hero h1 em,
	.footer-display em {
		font-style: normal;
		font-weight: 270;
	}

	.hero-footer {
		align-items: end;
	}

	.hero-footer > p:first-child {
		max-width: 580px;
		font-size: clamp(1.25rem, 2vw, 1.8rem);
		line-height: 1.2;
		letter-spacing: -0.035em;
	}

	.hero-glyphs {
		font-size: clamp(3rem, 7vw, 7rem);
		font-weight: 700;
		font-variation-settings: "wght" 700, "opsz" 32;
		line-height: 0.75;
		letter-spacing: -0.08em;
	}

	.section-shell {
		padding: 112px 0;
		border-top: 1px solid var(--line);
	}

	.section-heading {
		align-items: end;
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
	.section-note,
	.app-kicker {
		font-size: 11px;
		font-weight: 650;
		text-transform: uppercase;
		letter-spacing: 0.1em;
	}

	.section-note {
		max-width: 260px;
		line-height: 1.45;
		text-transform: none;
		letter-spacing: 0.02em;
	}

	.presets {
		display: flex;
		gap: 6px;
	}

	.presets button {
		padding: 8px 13px;
		border: 1px solid var(--line);
		border-radius: 999px;
		background: transparent;
		font: inherit;
		font-size: 12px;
		cursor: pointer;
	}

	.presets button:hover,
	.presets button:focus-visible {
		background: var(--ink);
		color: var(--paper);
		outline: none;
	}

	.live-specimen {
		display: grid;
		place-items: center;
		min-height: 440px;
		padding: 48px;
		border: 1px solid var(--ink);
		background: var(--ink);
		color: var(--paper);
		overflow: hidden;
	}

	.live-specimen textarea {
		width: 100%;
		margin: 0;
		padding: 0;
		border: 0;
		resize: none;
		background: transparent;
		color: inherit;
		font-family: inherit;
		font-size: clamp(2rem, var(--showcase-size), 7rem);
		font-weight: var(--showcase-weight);
		font-variation-settings: "wght" var(--showcase-weight), "opsz" var(--showcase-opsz);
		line-height: 0.98;
		letter-spacing: var(--showcase-tracking);
		text-align: center;
		outline: none;
		overflow: hidden;
	}

	.live-specimen textarea:focus-visible {
		outline: 2px solid var(--acid);
		outline-offset: 10px;
	}

	.control-grid {
		display: grid;
		grid-template-columns: repeat(4, 1fr);
		border: 1px solid var(--ink);
		border-top: 0;
	}

	.control-grid label {
		padding: 20px;
		border-right: 1px solid var(--line);
	}

	.control-grid label:last-child {
		border-right: 0;
	}

	.control-grid label > span {
		display: flex;
		justify-content: space-between;
		margin-bottom: 18px;
		font-size: 12px;
	}

	.control-grid b {
		font-weight: 650;
	}

	.control-grid output {
		font-variant-numeric: tabular-nums;
	}

	.control-grid input {
		width: 100%;
		accent-color: var(--ink);
	}

	.weight-list {
		border-top: 1px solid var(--ink);
	}

	.weight-row {
		display: grid;
		grid-template-columns: 80px 1fr 80px;
		align-items: baseline;
		gap: 20px;
		padding: 12px 0;
		border-bottom: 1px solid var(--line);
	}

	.weight-row span,
	.weight-row small {
		font-size: 11px;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}

	.weight-row small {
		text-align: right;
	}

	.weight-row p {
		font-size: clamp(2.5rem, 5.5vw, 5.6rem);
		font-weight: var(--row-weight);
		font-variation-settings: "wght" var(--row-weight), "opsz" 24;
		line-height: 1;
		letter-spacing: -0.055em;
	}

	.optical-grid {
		display: grid;
		grid-template-columns: 1fr 1fr;
		gap: 16px;
	}

	.optical-card {
		min-height: 480px;
		padding: 28px;
		border: 1px solid var(--line);
		background: rgb(255 255 255 / 24%);
	}

	.optical-card header {
		display: flex;
		justify-content: space-between;
		padding-bottom: 20px;
		border-bottom: 1px solid var(--line);
		font-size: 11px;
		font-weight: 650;
		text-transform: uppercase;
		letter-spacing: 0.08em;
	}

	.text-cut p {
		max-width: 42ch;
		margin: 80px auto 0;
		font-size: 18px;
		font-weight: 400;
		font-variation-settings: "wght" 400, "opsz" 14;
		line-height: 1.45;
		letter-spacing: -0.012em;
	}

	.display-cut {
		background: var(--acid);
	}

	.display-cut p {
		margin-top: 72px;
		font-size: clamp(3.8rem, 7vw, 7rem);
		font-weight: 620;
		font-variation-settings: "wght" 620, "opsz" 32;
		line-height: 0.82;
		letter-spacing: -0.07em;
	}

	.glyph-grid {
		display: grid;
		grid-template-columns: repeat(6, 1fr);
		border-top: 1px solid var(--ink);
		border-left: 1px solid var(--ink);
	}

	.glyph-grid div {
		position: relative;
		display: grid;
		place-items: center;
		aspect-ratio: 1;
		border-right: 1px solid var(--ink);
		border-bottom: 1px solid var(--ink);
	}

	.glyph-grid span {
		font-size: clamp(4rem, 9vw, 9rem);
		font-weight: 540;
		font-variation-settings: "wght" 540, "opsz" 32;
		line-height: 1;
	}

	.glyph-grid small {
		position: absolute;
		top: 12px;
		left: 14px;
		font-size: 10px;
	}

	.alphabet-specimen {
		display: grid;
		gap: 18px;
		padding: 64px 0;
		border-bottom: 1px solid var(--line);
		font-size: clamp(1.65rem, 3.8vw, 4.2rem);
		font-weight: 430;
		font-variation-settings: "wght" 430, "opsz" 24;
		line-height: 1;
		letter-spacing: -0.045em;
		overflow-wrap: anywhere;
	}

	.legibility-strip {
		position: relative;
		display: grid;
		grid-template-columns: repeat(3, 1fr);
		gap: 1px;
		margin-top: 32px;
		background: var(--line);
		border: 1px solid var(--line);
	}

	.legibility-strip p {
		display: flex;
		justify-content: space-around;
		padding: 38px 24px;
		background: var(--paper);
		font-size: clamp(2.8rem, 5vw, 5rem);
		font-weight: 450;
	}

	.legibility-strip small {
		position: absolute;
		right: 12px;
		bottom: -24px;
		font-size: 10px;
	}

	.app-window {
		display: grid;
		grid-template-columns: 280px 1fr;
		min-height: 650px;
		border: 1px solid #30302b;
		border-radius: 18px;
		background: #11110f;
		color: #f2f0e9;
		overflow: hidden;
		box-shadow: 0 30px 70px rgb(23 23 19 / 18%);
	}

	.app-window aside {
		padding: 24px 18px;
		border-right: 1px solid #30302b;
		background: #181816;
	}

	.window-controls {
		display: flex;
		gap: 6px;
		margin-bottom: 72px;
	}

	.window-controls i {
		width: 8px;
		height: 8px;
		border-radius: 50%;
		background: #4a4a44;
	}

	.app-window aside strong {
		display: block;
		margin: 8px 8px 28px;
		font-size: 20px;
		font-weight: 600;
		letter-spacing: -0.03em;
	}

	.app-window aside .app-kicker {
		margin-inline: 8px;
		color: #82827a;
	}

	.app-window nav {
		display: flex;
		flex-direction: column;
		gap: 4px;
	}

	.app-window nav a {
		display: flex;
		gap: 12px;
		padding: 11px 12px;
		border-radius: 8px;
		color: #8e8e86;
		font-size: 13px;
		text-decoration: none;
	}

	.app-window nav a.active {
		background: #292925;
		color: #f2f0e9;
	}

	.app-window nav span {
		color: #62625c;
		font-variant-numeric: tabular-nums;
	}

	.app-content {
		display: grid;
		grid-template-rows: auto 1fr auto;
		min-width: 0;
	}

	.app-content > header {
		display: flex;
		justify-content: space-between;
		padding: 20px 24px;
		border-bottom: 1px solid #30302b;
		font-size: 13px;
		font-weight: 560;
	}

	.app-content > header small {
		color: #7b7b74;
		font-size: 11px;
	}

	.conversation {
		align-self: center;
		width: min(100% - 80px, 700px);
		margin-inline: auto;
	}

	.conversation .app-kicker {
		color: #76766f;
	}

	.conversation h3 {
		max-width: 680px;
		margin: 16px 0 52px;
		font-size: clamp(2.5rem, 5vw, 5.5rem);
		font-weight: 480;
		font-variation-settings: "wght" 480, "opsz" 32;
		line-height: 0.95;
		letter-spacing: -0.055em;
	}

	.agent-row {
		display: grid;
		grid-template-columns: auto 1fr auto;
		align-items: center;
		gap: 12px;
		font-size: 12px;
	}

	.agent-row i {
		display: grid;
		place-items: center;
		width: 28px;
		height: 28px;
		border-radius: 50%;
		background: var(--acid);
		color: #11110f;
		font-style: normal;
		font-weight: 750;
	}

	.agent-row b {
		color: var(--acid);
		font-weight: 600;
	}

	.progress {
		height: 2px;
		margin-top: 16px;
		background: #292925;
	}

	.progress span {
		display: block;
		width: 62%;
		height: 100%;
		background: var(--acid);
	}

	.app-content > footer {
		display: flex;
		justify-content: space-between;
		margin: 0 24px 24px;
		padding: 17px 18px;
		border: 1px solid #30302b;
		border-radius: 12px;
		color: #73736c;
		font-size: 13px;
	}

	.app-content kbd {
		color: #c8c7c0;
		font-family: inherit;
	}

	.page-footer {
		display: grid;
		grid-template-columns: 1.5fr 0.5fr;
		gap: 80px;
		padding-bottom: 64px;
	}

	.footer-display {
		margin-top: 40px;
		font-size: clamp(4rem, 8vw, 9rem);
		font-weight: 580;
		font-variation-settings: "wght" 580, "opsz" 32;
		line-height: 0.82;
		letter-spacing: -0.065em;
	}

	.footer-meta {
		align-self: end;
		font-size: 13px;
		line-height: 1.45;
	}

	.footer-meta div {
		display: flex;
		gap: 18px;
		margin-top: 24px;
	}

	.footer-meta a {
		color: inherit;
		font-weight: 650;
		text-underline-offset: 4px;
	}

	@media (max-width: 800px) {
		.site-header,
		.section-shell,
		.hero {
			width: min(100% - 28px, 1440px);
		}

		.site-header {
			grid-template-columns: 1fr 1fr;
		}

		.header-mark {
			display: none;
		}

		.hero {
			min-height: 680px;
		}

		.hero h1 {
			font-size: clamp(4.2rem, 22vw, 8rem);
		}

		.eyebrow-row {
			align-items: start;
			flex-direction: column;
		}

		.hero-footer,
		.section-heading {
			align-items: start;
			flex-direction: column;
		}

		.hero-glyphs {
			align-self: end;
		}

		.section-shell {
			padding: 80px 0;
		}

		.section-heading {
			margin-bottom: 40px;
		}

		.presets {
			flex-wrap: wrap;
		}

		.live-specimen {
			min-height: 360px;
			padding: 28px;
		}

		.live-specimen textarea {
			font-size: min(var(--showcase-size), 2.8rem);
		}

		.control-grid,
		.optical-grid,
		.page-footer {
			grid-template-columns: 1fr;
		}

		.control-grid label {
			border-right: 0;
			border-bottom: 1px solid var(--line);
		}

		.control-grid label:last-child {
			border-bottom: 0;
		}

		.glyph-grid {
			grid-template-columns: repeat(3, 1fr);
		}

		.legibility-strip {
			grid-template-columns: 1fr;
		}

		.app-window {
			grid-template-columns: 1fr;
			min-height: 620px;
		}

		.app-window aside {
			display: none;
		}

		.conversation {
			width: min(100% - 40px, 700px);
		}

		.page-footer {
			gap: 64px;
		}
	}

	@media (prefers-reduced-motion: reduce) {
		*,
		*::before,
		*::after {
			scroll-behavior: auto !important;
			transition-duration: 0.01ms !important;
		}
	}
</style>
