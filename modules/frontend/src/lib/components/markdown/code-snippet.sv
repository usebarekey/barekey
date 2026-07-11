<script lang="ts">
	import CopyButton from "$lib/components/markdown/copy-button.sv";
	import SourceLocation from "$lib/components/markdown/source-location.sv";

	type Props = {
		char?: number;
		code: string;
		icon_source?: string;
		line?: number;
		link?: string;
		name?: string;
	};

	let { char, code, icon_source, line, link, name }: Props = $props();

	const has_header = $derived(
		Boolean(icon_source || name) || line !== undefined || char !== undefined,
	);
</script>

<div class="docs-code-snippet not-prose">
	{#if !has_header}
		<CopyButton
			class="docs-code-snippet-copy docs-code-snippet-copy-overlay"
			copy_kind="code"
			label="Copy code"
		/>
	{/if}
	<div class="docs-code-snippet-body">
		{#if has_header}
			<div class="docs-code-snippet-header">
				<SourceLocation
					{char}
					class="docs-code-snippet-filename"
					{icon_source}
					{line}
					{link}
					{name}
				/>
				<CopyButton class="docs-code-snippet-copy" copy_kind="code" label="Copy code" />
			</div>
		{/if}
		{@html code}
	</div>
</div>
