<script lang="ts">
	import type { Component } from "svelte";
	import Bulb from "@tabler/icons-svelte/icons/bulb";
	import InfoCircle from "@tabler/icons-svelte/icons/info-circle";
	import AlertTriangle from "@tabler/icons-svelte/icons/alert-triangle";

	type NoteVariant = "info" | "tip" | "warning";

	type Props = {
		icon: "default" | "none";
		title: string;
		variant: NoteVariant;
	};

	const note_icons = {
		info: InfoCircle,
		tip: Bulb,
		warning: AlertTriangle,
	} satisfies Record<NoteVariant, Component>;

	let { icon, title, variant }: Props = $props();

	const Icon = $derived(note_icons[variant]);
</script>

<div class="docs-note-header">
	{#if icon === "default"}
		<Icon aria-hidden="true" class="docs-note-icon" />
	{/if}
	<div class="docs-note-title">{title}</div>
</div>
