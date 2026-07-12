<script lang="ts" effect>
	import { Effect } from "effect";
	import { tick } from "svelte";

	let {
		article_viewport,
		compact,
	}: {
		article_viewport: HTMLElement | null;
		compact: boolean;
	} = $props();

	const ResetScroll = Effect.gen(function* () {
		yield* Effect.promise(tick);
		yield* Effect.sync(() => {
			if (compact) window.scrollTo({ top: 0 });
			article_viewport?.scrollTo({ top: 0 });
		});
	});

	yield* ResetScroll;
</script>
