<script lang="ts">
	import { ModeWatcher } from "mode-watcher";
	import "$lib/client/copy-button";
	import "$lib/client/prose-media-width";
	import "$lib/styles/fonts.css";
	import "$lib/styles/global.css";
	import favicon from "$lib/assets/barekey/barekey-padded.png";

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<ModeWatcher defaultMode="dark" track={false} darkClassNames={["dark"]} />
{@render children()}
