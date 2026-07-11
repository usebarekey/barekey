<script lang="ts">
	import SourceLocation from "$lib/components/markdown/source-location.sv";

	type Props = {
		char?: number;
		icon?: string;
		line?: number;
		link?: string;
		name: string;
	};

	let { char, icon, line, link, name }: Props = $props();
</script>

<SourceLocation
	{char}
	class="docs-inline-code-source-location"
	icon_source={icon ?? name}
	{line}
	{link}
	{name}
/>
