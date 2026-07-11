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
	class="docs-command-snippet-option"
	data-command-option={value}
	hidden={!selected}
	use:middle_ellipsis_command={command}
	aria-label={command}
>
	<div class="docs-command-snippet-source" data-command-source>
		{#if children}
			{@render children()}
		{:else}
			<pre class="shiki shiki-themes github-light github-dark"><code>{command}</code></pre>
		{/if}
	</div>
	<div class="docs-command-snippet-middle-display" data-command-middle-display aria-hidden="true"></div>
</div>
