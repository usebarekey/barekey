<script lang="ts">
	import '$lib/styles/fonts.css';
	import '$lib/styles/global.css';
	import favicon from '$lib/assets/favicon.svg';
	import { ModeWatcher } from 'mode-watcher';

	let { children } = $props();
</script>

<svelte:head><link rel="icon" href={favicon} /></svelte:head>
<ModeWatcher defaultMode="dark" track={false} darkClassNames={['dark']} />
{@render children()}
