<script lang="ts">
	import { themes, type ChartConfig } from "./chart-utils.js";

	let { id, config }: { id: string; config: ChartConfig } = $props();

	const color_config = $derived(
		config ? Object.entries(config).filter(([, config]) => config.theme || config.color) : null
	);

	const theme_contents = $derived.by(() => {
		if (!color_config || !color_config.length) return;

		const theme_contents = [];
		for (const [_theme, prefix] of Object.entries(themes)) {
			let content = `${prefix} [data-chart=${id}] {\n`;
			const color = color_config.map(([key, item_config]) => {
				const theme = _theme as keyof typeof item_config.theme;
				const color = item_config.theme?.[theme] || item_config.color;
				return color ? `\t--color-${key}: ${color};` : null;
			});

			content += color.join("\n") + "\n}";

			theme_contents.push(content);
		}

		return theme_contents.join("\n");
	});
</script>

{#if theme_contents}
	{#key id}
		<svelte:element this={"style"}>
			{theme_contents}
		</svelte:element>
	{/key}
{/if}
