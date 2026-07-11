<script lang="ts">
	import { capture_event } from "$lib/client/analytics";
	import { Effect } from "effect";
	import type { Component } from "svelte";
	import Button from "$lib/components/ui/button/button.sv";
	import { SvglBunLogo, SvglDenoLogo, SvglNPMLogo, SvglPnpmLogo } from "@selemondev/svgl-svelte";
	import Book from "@tabler/icons-svelte/icons/book";
	import Check from "@tabler/icons-svelte/icons/check";
	import Copy from "@tabler/icons-svelte/icons/copy";
	import CreditCard from "@tabler/icons-svelte/icons/credit-card";
	import MarketingFrame from "./marketing-frame.sv";

	type Provider = {
		name: string;
		icon: Component;
		command: string;
		icon_class?: string;
	};

	const providers = [
		{
			name: "Deno",
			icon: SvglDenoLogo,
			command: "deno install -g -A npm:@barekey/cli",
			icon_class: "dark:invert",
		},
		{
			name: "Bun",
			icon: SvglBunLogo,
			command: "bun install -g @barekey/cli",
		},
		{
			name: "pnpm",
			icon: SvglPnpmLogo,
			command: "pnpm add -g @barekey/cli",
		},
		{
			name: "npm",
			icon: SvglNPMLogo,
			command: "npm install -g @barekey/cli",
		},
	] satisfies Provider[];

	let selected_provider = $state<Provider>(providers[0]);
	let copied_command = $state<string>();
	let copy_generation = 0;

	const CopyWithTextarea = (command: string) =>
		Effect.sync(() => {
			const textarea = document.createElement("textarea");

			textarea.value = command;
			textarea.setAttribute("readonly", "");
			textarea.style.position = "fixed";
			textarea.style.left = "-9999px";
			document.body.append(textarea);
			textarea.select();
			document.execCommand("copy");
			textarea.remove();
		});

	const WriteClipboard = (command: string) => {
		if (!navigator.clipboard?.writeText) {
			return CopyWithTextarea(command);
		}

		return Effect.tryPromise({
			try: () => navigator.clipboard.writeText(command),
			catch: (error) => error,
		}).pipe(
			Effect.timeout("500 millis"),
			Effect.catchIf(() => true, () => CopyWithTextarea(command)),
		);
	};

	const CopyCommand = (command: string, package_manager: string) =>
		Effect.gen(function* () {
			const generation = ++copy_generation;

			yield* WriteClipboard(command);
			capture_event("cli_install_copied", { package_manager });
			copied_command = command;

			yield* Effect.sleep("1200 millis");

			if (generation === copy_generation) {
				copied_command = undefined;
			}
		});
</script>

<svelte:head>
	<title>Barekey</title>
	<meta
		name="description"
		content="One platform for everything your application needs to know."
	/>
</svelte:head>

<main class="mx-auto flex min-h-screen w-full max-w-6xl items-center px-6 py-20 sm:px-8">
	<div class="flex w-full flex-col gap-10">
		<header class="relative z-10 flex max-w-3xl flex-col gap-5">
			<nav aria-label="Primary" class="flex items-center gap-2">
				<Button href="/docs/ser/introduction" variant="secondary">
					<Book data-icon="inline-start" />
					Docs
				</Button>
				<Button href="/pricing" variant="secondary">
					<CreditCard data-icon="inline-start" />
					Pricing
				</Button>
			</nav>

			<h1 class="font-heading text-5xl leading-[1.05] font-light text-muted-foreground sm:text-6xl">
				<span class="text-foreground">One platform</span> for everything your application needs to
				know.
			</h1>
		</header>

		<MarketingFrame class="z-10 p-5 sm:p-8">
			<div class="flex flex-col gap-3">
				<div class="flex flex-wrap gap-1" role="tablist" aria-label="Package manager">
					{#each providers as provider}
						{@const selected = provider.name === selected_provider.name}
						<button
							type="button"
							role="tab"
							aria-selected={selected}
							onclick={() => (selected_provider = provider)}
							class="focus-visible:border-ring focus-visible:ring-ring/50 inline-flex items-center gap-2 rounded-lg border border-transparent px-3 py-1.5 text-sm text-muted-foreground transition-colors outline-none hover:text-foreground focus-visible:ring-3 {selected
								? 'bg-muted text-foreground'
								: ''}"
						>
							<provider.icon class="size-4 grayscale {provider.icon_class ?? ''}" />
							{provider.name}
						</button>
					{/each}
				</div>

				<div class="relative flex min-h-20 items-center rounded-2xl bg-muted/60 px-5 pr-14 sm:px-7 sm:pr-16">
					<code class="overflow-x-auto font-mono text-sm text-muted-foreground sm:text-base">
						<span class="select-none text-foreground">$</span> {selected_provider.command}
					</code>
					<button
						type="button"
						aria-label="Copy install command"
						onclick={yield* CopyCommand(
							selected_provider.command,
							selected_provider.name.toLowerCase(),
						)}
						class="focus-visible:border-ring focus-visible:ring-ring/50 absolute right-3 inline-flex size-9 items-center justify-center rounded-lg border border-transparent text-muted-foreground transition-all outline-none hover:bg-background hover:text-foreground active:scale-90 focus-visible:ring-3 sm:right-4"
					>
						{#if copied_command === selected_provider.command}
							<Check class="size-4" />
						{:else}
							<Copy class="size-4" />
						{/if}
					</button>
				</div>
			</div>
		</MarketingFrame>
	</div>
</main>
