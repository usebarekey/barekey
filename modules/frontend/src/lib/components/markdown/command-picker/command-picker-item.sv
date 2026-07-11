<script lang="ts">
	import type { Snippet } from "svelte";
	import { get_command_picker_context } from "$lib/components/markdown/command-picker/context";

	type Props = {
		children?: Snippet;
		command: string;
		icon?: string;
		label?: string;
		value: string;
	};

	let { children, command, value }: Props = $props();

	const command_picker = get_command_picker_context();
	const selected = $derived(command_picker.get_selected_value() === value);
</script>

<div class="docs-command-snippet-option" data-command-option={value} hidden={!selected}>
	{#if children}
		{@render children()}
	{:else}
		<pre class="shiki shiki-themes github-light github-dark"><code>{command}</code></pre>
	{/if}
</div>
