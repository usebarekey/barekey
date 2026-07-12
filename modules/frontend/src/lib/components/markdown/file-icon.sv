<script lang="ts">
	import { cn } from "$lib/utils";
	import { onMount, type Component } from "svelte";
	import { get_file_icon_identifier } from "$lib/data/icon-identifiers";
	import {
		get_file_icon_label,
		get_svgl_icon_name,
		type SvglIconName,
	} from "$lib/components/markdown/file-icon-data";
	import {
		SvglBunLogo,
		SvglDenoLogo,
		SvglJavaScriptLogo,
		SvglMarkdownLogo,
		SvglNPMLogo,
		SvglPnpmLogo,
		SvglSvelteLogo,
		SvglTailwindCSSLogo,
		SvglTypeScriptLogo,
		SvglViteLogo,
		SvglVltLogo,
		SvglYarnLogo,
	} from "@selemondev/svgl-svelte";

	type Props = {
		class?: string;
		name?: string;
	};

	const svgl_icon_components = {
		Bun: SvglBunLogo,
		Deno: SvglDenoLogo,
		JavaScript: SvglJavaScriptLogo,
		Markdown: SvglMarkdownLogo,
		NPM: SvglNPMLogo,
		Pnpm: SvglPnpmLogo,
		Svelte: SvglSvelteLogo,
		TailwindCSS: SvglTailwindCSSLogo,
		TypeScript: SvglTypeScriptLogo,
		Vite: SvglViteLogo,
		Vlt: SvglVltLogo,
		Yarn: SvglYarnLogo,
	} satisfies Record<SvglIconName, Component>;

	let { class: class_name, name }: Props = $props();
	let mounted = $state(false);

	const icon_identifier = $derived(get_file_icon_identifier(name));
	const svgl_icon_name = $derived(get_svgl_icon_name(icon_identifier));
	const Icon = $derived(svgl_icon_name ? svgl_icon_components[svgl_icon_name] : undefined);

	onMount(() => {
		mounted = true;
	});
</script>

{#if icon_identifier}
	{#if Icon}
		<span
			class={cn(
				"docs-file-icon docs-file-icon-brand block size-4 shrink-0 dark:data-[file-icon=deno]:invert dark:data-[file-icon=vlt]:invert [&_svg]:block [&_svg]:size-full",
				class_name,
			)}
			data-file-icon={icon_identifier}
			aria-hidden="true"
		>
			{#if mounted}
				<Icon width={16} height={16} />
			{/if}
		</span>
	{:else}
		<span
			class={cn(
				"docs-file-icon docs-file-icon-label inline-flex size-4 min-w-4 shrink-0 items-center justify-center rounded-[0.25rem] bg-linear-to-t from-background/30 to-foreground/5 px-1 font-mono text-[0.55rem] leading-none font-semibold text-muted-foreground card",
				class_name,
			)}
			data-file-icon={icon_identifier}
			aria-hidden="true"
		>
			{get_file_icon_label(icon_identifier)}
		</span>
	{/if}
{/if}
