<script lang="ts" effect>
	import { browser } from "$app/environment";
	import { Effect, Schema } from "effect";
	import { ContributorsResponseSchema } from "$lib/data/github-contributors";

	import ContributorCard from "$lib/components/custom/contributor-card.sv";

	const FetchContributors = Effect.tryPromise({
		try: () => fetch("/api/github/contributors"),
		catch: (cause) => new Error("Could not load contributors: " + String(cause)),
	}).pipe(
		Effect.flatMap((response) =>
			response.ok
				? Effect.tryPromise({
						try: () => response.json(),
						catch: (cause) => new Error("Could not decode contributors: " + String(cause)),
					})
				: Effect.fail(
						new Error("Could not load contributors: " + response.status.toString()),
					),
		),
		Effect.flatMap(Schema.decodeUnknownEffect(ContributorsResponseSchema)),
		Effect.map((response) => response.contributors),
		Effect.catch(() => Effect.succeed([])),
	);

	const contributors = browser ? yield* FetchContributors : null;
</script>

{#if contributors === null}
	<p>Loading contributors...</p>
{:else if contributors.length}
	<ul class="not-prose space-y-2">
		{#each contributors as contributor (contributor.name)}
			<ContributorCard {contributor} />
		{/each}
	</ul>
{:else}
	<p class="font-normal text-muted-foreground">
		<strong class="font-semibold text-foreground">Oh no!</strong>
		We hit the GitHub rate limit when fetching contributor data. Be back soon..!
	</p>
{/if}
