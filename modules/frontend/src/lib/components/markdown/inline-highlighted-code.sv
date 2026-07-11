<script lang="ts">
	export type InlineHighlightedCodeToken = {
		content: string;
		style?: string;
	};

	type Props = {
		lines: InlineHighlightedCodeToken[][];
	};

	let { lines }: Props = $props();
</script>

{#each lines as line, line_index}{#if line_index > 0}{"\n"}{/if}{#each line as token}<span
			style={token.style}>{token.content}</span
		>{/each}{/each}
