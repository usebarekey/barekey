<script lang="ts">
	import type { PageProps } from "./$types";
	import OgCard from "$lib/components/og/og-card.sv";
	import barekey_logo from "$lib/assets/barekey/logo.png";
	import heading_font from "$lib/assets/fonts/artisan-neo/artisan-neo-variable.woff2";

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>{data.title} | Barekey</title>
	<link rel="preload" href={heading_font} as="font" type="font/woff2" crossorigin="anonymous" />
</svelte:head>

<OgCard description={data.description} logo_src={barekey_logo} title={data.title} />
