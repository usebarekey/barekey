<script lang="ts" effect>
	import { CaptureEvent, GetPagePath } from "$lib/client/analytics";
	import { Effect } from "effect";
	import FileIcon from "$lib/components/markdown/file-icon.sv";

	type Props = {
		char?: number;
		class?: string;
		icon_source?: string;
		line?: number;
		link?: string;
		name?: string;
	};

	let {
		char,
		class: class_name,
		icon_source,
		line,
		link,
		name,
	}: Props = $props();

	const TrackExternalSourceClick = Effect.gen(function* () {
		const source_url = link;

		if (!source_url) {
			return;
		}

		const page_path = yield* GetPagePath;

		yield* CaptureEvent("external_source_clicked", {
			page_path,
			source_name: name,
			source_url,
		});
	});
</script>

{#snippet content()}
	<FileIcon name={icon_source} />
	{#if name}
		<span class="docs-source-location-name">{name}</span>
	{/if}
	{#if line !== undefined || char !== undefined}
		<span class="docs-source-location-position">
			{#if line !== undefined}L{line}{/if}{#if line !== undefined && char !== undefined}{" @ "}{/if}{#if char !== undefined}C{char}{/if}
		</span>
	{/if}
{/snippet}

{#if link}
	<a
		class={class_name}
		href={link}
		rel="external noopener noreferrer"
		target="_blank"
		onclick={yield* TrackExternalSourceClick}
	>
		{@render content()}
	</a>
{:else}
	<span class={class_name}>
		{@render content()}
	</span>
{/if}
