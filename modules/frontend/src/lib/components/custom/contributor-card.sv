<script lang="ts">
	import { cubicOut } from "svelte/easing";
	import { Badge } from "$lib/components/ui/badge";
	import { prefersReducedMotion, Tween } from "svelte/motion";

	type Contributor = {
		avatar: string;
		commits: number;
		diff: {
			minus: number;
			plus: number;
		};
		name: string;
	};

	let { contributor }: { contributor: Contributor } = $props();

	const compact_units = ["", "K", "M", "B", "T"];
	const minus = new Tween(0, { duration: 600, easing: cubicOut });
	const plus = new Tween(0, { duration: 600, easing: cubicOut });
	const diff_card_id = $derived(contributor.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"));
	const diff_clip_id = $derived(`${diff_card_id}-diff-clip`);
	const minus_gradient_id = $derived(`${diff_card_id}-minus-gradient`);
	const plus_gradient_id = $derived(`${diff_card_id}-plus-gradient`);

	let card_element = $state<HTMLElement | null>(null);
	let diff_pill_element = $state<HTMLElement | null>(null);
	let diff_card_width = $state(100);
	let has_counted = $state(false);

	const diff_card_right_curve = $derived(diff_card_width - 12);
	const diff_card_right_edge = $derived(diff_card_width - 0.5);
	const diff_clip_width = $derived(diff_card_width - 1);
	const diff_slash_bottom = $derived(diff_card_width / 2 - 0.75);
	const diff_slash_top = $derived(diff_card_width / 2 + 0.75);

	const format_diff = (value: number) => {
		let scaled_value = value;
		let unit_index = 0;

		while (scaled_value >= 999.5 && unit_index < compact_units.length - 1) {
			scaled_value /= 1_000;
			unit_index += 1;
		}

		if (unit_index === 0) {
			return Math.round(scaled_value).toString();
		}

		const rounded_value = Math.round(scaled_value * 10) / 10;
		const compact_value =
			rounded_value < 10 && !Number.isInteger(rounded_value)
				? rounded_value.toFixed(1)
				: Math.round(rounded_value).toString();

		return `${compact_value}${compact_units[unit_index]}`;
	};

	$effect(() => {
		const pill_element = diff_pill_element;

		if (!pill_element) {
			return;
		}

		const update_view_box = () => {
			const { width, height } = pill_element.getBoundingClientRect();

			if (height === 0) {
				return;
			}

			diff_card_width = (width / height) * 24;
		};
		const observer = new ResizeObserver(update_view_box);

		observer.observe(pill_element);
		update_view_box();

		return () => observer.disconnect();
	});

	$effect(() => {
		if (!card_element || has_counted) {
			return;
		}

		if (prefersReducedMotion.current) {
			has_counted = true;
			void minus.set(contributor.diff.minus, { duration: 0 });
			void plus.set(contributor.diff.plus, { duration: 0 });

			return;
		}

		const observer = new IntersectionObserver(
			([entry]) => {
				if (!entry?.isIntersecting) {
					return;
				}

				has_counted = true;
				void minus.set(contributor.diff.minus);
				void plus.set(contributor.diff.plus);
				observer.disconnect();
			},
			{ threshold: 0.4 },
		);

		observer.observe(card_element);

		return () => observer.disconnect();
	});
</script>

<article
	bind:this={card_element}
	class="relative isolate min-w-0 overflow-hidden rounded-full bg-background card"
>
	<img
		src={contributor.avatar}
		alt=""
		aria-hidden="true"
		class="pointer-events-none absolute inset-0 size-full scale-125 object-cover opacity-70"
	/>
	<div
		aria-hidden="true"
		class="pointer-events-none absolute inset-0 bg-linear-to-r from-background/65 via-background/70 to-background/80 backdrop-blur-xl"
	></div>

	<div class="relative flex min-h-12 min-w-0 items-center gap-1.5 px-3 py-2">
		<p class="min-w-0 truncate font-heading text-sm font-semibold text-foreground">
			{contributor.name}
		</p>
		<Badge
			variant="outline"
			class="bg-background/55 font-mono text-[0.6875rem] text-muted-foreground backdrop-blur-md"
		>
			{contributor.commits.toLocaleString("en-US")}
			{contributor.commits === 1 ? "commit" : "commits"}
		</Badge>

		<div
			bind:this={diff_pill_element}
			class="contributor-diff-pill ml-auto flex shrink-0 rounded-full backdrop-blur-xl"
			aria-label={`${contributor.diff.plus.toLocaleString("en-US")} lines added and ${contributor.diff.minus.toLocaleString("en-US")} lines removed`}
		>
			<svg
				class="contributor-diff-card docs-code-diff-card"
				viewBox={`0 0 ${diff_card_width} 24`}
				preserveAspectRatio="none"
				aria-hidden="true"
			>
				<defs>
					<linearGradient id={plus_gradient_id} x1="0" x2="0" y1="0" y2="1">
						<stop class="contributor-diff-plus-gradient-start" offset="0%" />
						<stop class="contributor-diff-plus-gradient-end" offset="100%" />
					</linearGradient>
					<linearGradient id={minus_gradient_id} x1="0" x2="0" y1="0" y2="1">
						<stop class="contributor-diff-minus-gradient-start" offset="0%" />
						<stop class="contributor-diff-minus-gradient-end" offset="100%" />
					</linearGradient>
					<clipPath id={diff_clip_id}>
						<rect x="0.5" y="0.5" width={diff_clip_width} height="23" rx="11.5" />
					</clipPath>
				</defs>
				<g clip-path={`url(#${diff_clip_id})`}>
					<polygon
						points={`0,0 ${diff_slash_top + 0.2},0 ${diff_slash_bottom + 0.2},24 0,24`}
						fill={`url(#${plus_gradient_id})`}
					/>
					<polygon
						points={`${diff_slash_top},0 ${diff_card_width},0 ${diff_card_width},24 ${diff_slash_bottom},24`}
						fill={`url(#${minus_gradient_id})`}
					/>
				</g>
				<path
					class="contributor-diff-outline-plus"
					d={`M ${diff_slash_top} 0.5 H 12 A 11.5 11.5 0 0 0 0.5 12 A 11.5 11.5 0 0 0 12 23.5 H ${diff_slash_bottom}`}
				/>
				<path
					class="contributor-diff-outline-minus"
					d={`M ${diff_slash_top} 0.5 H ${diff_card_right_curve} A 11.5 11.5 0 0 1 ${diff_card_right_edge} 12 A 11.5 11.5 0 0 1 ${diff_card_right_curve} 23.5 H ${diff_slash_bottom}`}
				/>
			</svg>
			<span class="contributor-diff-segment contributor-diff-plus ps-2 pe-1">
				<span aria-hidden="true">+</span>
				<span class="max-w-[4ch] text-left tabular-nums">{format_diff(plus.current)}</span>
			</span>
			<span class="contributor-diff-segment contributor-diff-minus ps-1 pe-2">
				<span aria-hidden="true">-</span>
				<span class="max-w-[4ch] text-left tabular-nums">{format_diff(minus.current)}</span>
			</span>
		</div>
	</div>
</article>

<style>
	.contributor-diff-pill {
		--contributor-diff-minus: oklch(0.68 0.2 25);
		--contributor-diff-plus: oklch(0.72 0.19 145);
		isolation: isolate;
	}

	.contributor-diff-card {
		--shiki-diff-light: var(--contributor-diff-plus);
		inset: 0;
		display: block;
		width: 100%;
		height: 100%;
	}

	.contributor-diff-plus-gradient-start {
		stop-color: color-mix(in oklab, var(--contributor-diff-plus) 12.5%, transparent);
	}

	.contributor-diff-plus-gradient-end {
		stop-color: color-mix(in oklab, var(--contributor-diff-plus) 20%, transparent);
	}

	.contributor-diff-minus-gradient-start {
		stop-color: color-mix(in oklab, var(--contributor-diff-minus) 9%, transparent);
	}

	.contributor-diff-minus-gradient-end {
		stop-color: color-mix(in oklab, var(--contributor-diff-minus) 18%, transparent);
	}

	.contributor-diff-card .contributor-diff-outline-plus,
	.contributor-diff-card .contributor-diff-outline-minus {
		fill: none;
		stroke-linecap: butt;
		stroke-linejoin: round;
		stroke-width: 1px;
	}

	.contributor-diff-card .contributor-diff-outline-plus {
		stroke: color-mix(in oklab, var(--contributor-diff-plus) 36%, transparent);
	}

	.contributor-diff-card .contributor-diff-outline-minus {
		stroke: color-mix(in oklab, var(--contributor-diff-minus) 24%, transparent);
	}

	.contributor-diff-segment {
		display: inline-flex;
		align-items: center;
		gap: 0.125rem;
		padding-block: 0.25rem;
		color: color-mix(in oklab, var(--shiki-diff-light) 72%, var(--foreground));
		font-family: var(--font-mono);
		font-size: 0.75rem;
		line-height: 1rem;
	}

	.contributor-diff-plus {
		--shiki-diff-light: var(--contributor-diff-plus);
	}

	.contributor-diff-minus {
		--shiki-diff-light: var(--contributor-diff-minus);
	}
</style>
