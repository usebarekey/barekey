<script lang="ts">
	import Badge from "$lib/components/ui/badge/badge.sv";
	import Switch from "$lib/components/ui/switch/switch.sv";
	import AppWindow from "@tabler/icons-svelte/icons/app-window";
	import ArrowNarrowLeft from "@tabler/icons-svelte/icons/arrow-narrow-left";
	import Cpu2 from "@tabler/icons-svelte/icons/cpu-2";
	import CubePlus from "@tabler/icons-svelte/icons/cube-plus";
	import Flask from "@tabler/icons-svelte/icons/flask";
	import Headset from "@tabler/icons-svelte/icons/headset";
	import Users from "@tabler/icons-svelte/icons/users";
	import { fade, slide } from "svelte/transition";
	import MarketingFrame from "../../components/marketing-frame.sv";

	type Plan = {
		annual_price_cents: number;
		always_included: string[];
		included: {
			evaluations: number;
			experiments: number;
		};
		monthly_price_cents: number;
		name: string;
		overage_cents_per_million?: number;
		overage_experiment_cents?: number;
		tagline: string;
	};

	const plans: Plan[] = [
		{
			annual_price_cents: 0,
			always_included: ["Unlimited organizations", "Unlimited projects", "Community support"],
			included: { evaluations: 100_000, experiments: 1 },
			monthly_price_cents: 0,
			name: "Free",
			tagline: "For development and small-scale production.",
		},
		{
			annual_price_cents: 8_640,
			always_included: ["Unlimited organizations", "Unlimited projects", "Email support"],
			included: { evaluations: 2_000_000, experiments: 5 },
			monthly_price_cents: 9_000,
			name: "Pro",
			overage_cents_per_million: 500,
			tagline: "For growing production apps.",
		},
		{
			annual_price_cents: 95_040,
			always_included: [
				"Unlimited organizations",
				"Unlimited projects",
				"Priority support",
				"Feature requests",
			],
			included: { evaluations: 20_000_000, experiments: 25 },
			monthly_price_cents: 99_000,
			name: "Max",
			overage_cents_per_million: 300,
			overage_experiment_cents: 2_500,
			tagline: "For high-traffic teams running experiments.",
		},
	];

	let annual = $state(true);
	let overages = $state(true);

	const format_currency = (cents: number) => {
		const dollars = cents / 100;

		return dollars % 1 === 0 ? `$${dollars}` : `$${dollars.toFixed(2)}`;
	};

	const format_number = (value: number) => new Intl.NumberFormat("en-US").format(value);

	const monthly_equivalent_cents = (plan: Plan) =>
		annual ? plan.annual_price_cents / 12 : plan.monthly_price_cents;

	const price_suffix = (plan: Plan) =>
		annual && plan.monthly_price_cents > 0 ? "per month, billed yearly" : "per month";

	const experiment_overage_copy = (plan: Plan) =>
		plan.overage_experiment_cents
			? `${format_currency(plan.overage_experiment_cents)} per additional experiment`
			: "Upgrade to Max for experiment overages";
</script>

<svelte:head>
	<title>Pricing · Barekey</title>
	<meta name="description" content="Predictable Barekey pricing at every step." />
</svelte:head>

<main class="mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-16 sm:px-8">
	<div class="flex w-full flex-col gap-10">
		<header class="relative z-10 flex flex-col gap-5">
			<a
				href="/"
				class="inline-flex w-fit items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
			>
				<ArrowNarrowLeft class="size-4" />
				Go back
			</a>

			<div class="flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
				<h1 class="font-heading max-w-2xl text-5xl leading-[1.05] font-light text-muted-foreground sm:text-6xl">
					<span class="text-foreground">Predictable pricing</span> at every step.
				</h1>

				<div class="flex flex-wrap items-center gap-x-7 gap-y-4 text-sm">
					<div class="flex items-center gap-2">
						<Switch
							aria-label="Overages enabled"
							checked={overages}
							onCheckedChange={(checked) => (overages = checked)}
						/>
						Overages enabled
					</div>
					<div class="relative flex items-center gap-2">
						<Switch
							aria-label="Annual pricing"
							checked={annual}
							onCheckedChange={(checked) => (annual = checked)}
						/>
						Annual pricing
						<Badge class="absolute -top-6 -right-6 rotate-6 bg-yellow-500 text-yellow-950">
							20% off
						</Badge>
					</div>
				</div>
			</div>
		</header>

		<div class="grid grid-cols-1 gap-12 lg:grid-cols-3 lg:gap-14">
			{#each plans as plan}
				<MarketingFrame class="z-10 p-6 sm:p-8">
					<div class="flex h-full flex-col gap-8">
						<section class="flex flex-col gap-2">
							<h2 class="font-heading text-2xl font-medium text-foreground">{plan.name}</h2>
							<p class="min-h-[4.5rem] text-sm leading-relaxed text-muted-foreground">
								{plan.tagline} Available for
								<span class="text-foreground tabular-nums">
									{format_currency(monthly_equivalent_cents(plan))}
								</span>
								{price_suffix(plan)}.
								{#if annual && plan.monthly_price_cents > 0}
									<span transition:fade={{ duration: 120 }}>
										That comes to {format_currency(plan.annual_price_cents)} yearly.
									</span>
								{/if}
							</p>
						</section>

						<section class="flex flex-col gap-4">
							<h3 class="text-sm font-medium">Included each month</h3>
							<ul class="space-y-2 text-sm text-muted-foreground">
								<li class="flex items-start gap-2">
									<Cpu2 class="mt-0.5 size-4 shrink-0 text-foreground" />
									<span class="flex flex-col">
										{format_number(plan.included.evaluations)} evaluations
										{#if overages && plan.overage_cents_per_million}
											<small transition:slide={{ duration: 160 }}>
												+ {format_currency(plan.overage_cents_per_million)} per additional 1,000,000
											</small>
										{/if}
									</span>
								</li>
								<li class="flex items-start gap-2">
									<Flask class="mt-0.5 size-4 shrink-0 text-foreground" />
									<span class="flex flex-col">
										{plan.included.experiments}
										{plan.included.experiments === 1 ? "experiment" : "experiments"}
										{#if overages && plan.overage_cents_per_million}
											<small transition:slide={{ duration: 160 }}>
												+ {experiment_overage_copy(plan)}
											</small>
										{/if}
									</span>
								</li>
							</ul>
						</section>

						<section class="flex flex-col gap-4">
							<h3 class="text-sm font-medium">Always included</h3>
							<ul class="space-y-2 text-sm text-muted-foreground">
								{#each plan.always_included as item}
									<li class="flex items-center gap-2">
										{#if item.includes("organizations")}
											<Users class="size-4 text-foreground" />
										{:else if item.includes("projects")}
											<AppWindow class="size-4 text-foreground" />
										{:else if item.includes("Feature")}
											<CubePlus class="size-4 text-foreground" />
										{:else}
											<Headset class="size-4 text-foreground" />
										{/if}
										{item}
									</li>
								{/each}
							</ul>
						</section>
					</div>
				</MarketingFrame>
			{/each}
		</div>

		<p class="text-center text-sm text-muted-foreground sm:text-base">
			To change your plan, run
			<code class="mx-1 inline-block rounded-md bg-card px-2 py-1 font-mono text-sm text-foreground">
				barekey orgs modify
			</code>
			and follow the terminal.
		</p>
	</div>
</main>
