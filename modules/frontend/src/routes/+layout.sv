<script lang="ts">
	import { ModeWatcher } from "mode-watcher";
	import "$lib/client/copy-button";
	import "$lib/client/diff-code-card";
	import "$lib/client/heading-links";
	import "$lib/client/prose-media-width";
	import "$lib/styles/fonts.css";
	import "$lib/styles/global.css";
	import body_font from "$lib/assets/fonts/neue-montreal/pp-neue-montreal-regular.otf";
	import code_font from "$lib/assets/fonts/jetbrains-mono/variable.woff2";
	import favicon from "$lib/assets/barekey/barekey-padded.png";
	import heading_font from "$lib/assets/fonts/geist/geist-wght.woff2";
	import logo_font from "$lib/assets/fonts/calsans/variable.woff2";

	let { children } = $props();
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
	<link rel="preload" href={body_font} as="font" type="font/otf" crossorigin="anonymous" />
	<link rel="preload" href={code_font} as="font" type="font/woff2" crossorigin="anonymous" />
	<link rel="preload" href={heading_font} as="font" type="font/woff2" crossorigin="anonymous" />
	<link rel="preload" href={logo_font} as="font" type="font/woff2" crossorigin="anonymous" />
</svelte:head>
<ModeWatcher defaultMode="dark" track={false} darkClassNames={["dark"]} />
{@render children()}
