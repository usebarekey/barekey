<script lang="ts">
	import type { Snippet } from "svelte";
	import { middle_ellipsis_command } from "$lib/client/command-middle-ellipsis";
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

<div
	class="docs-command-snippet-option group/command-option relative min-w-0 max-w-full"
	data-command-option={value}
	hidden={!selected}
	use:middle_ellipsis_command={command}
	aria-label={command}
>
	<div class="min-w-0 max-w-full group-data-[command-truncated=true]/command-option:sr-only" data-command-source>
		{#if children}
			{@render children()}
		{:else}
			<pre class="shiki shiki-themes github-light github-dark"><code>{command}</code></pre>
		{/if}
	</div>
	<div
		class="docs-command-snippet-middle-display hidden min-w-0 max-w-full overflow-hidden whitespace-pre font-mono text-sm leading-6 font-normal group-data-[command-truncated=true]/command-option:block"
		data-command-middle-display
		aria-hidden="true"
	></div>
</div>
