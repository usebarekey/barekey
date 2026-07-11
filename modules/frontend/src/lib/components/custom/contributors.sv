<script lang="ts" effect>
	import { browser } from "$app/environment";
	import { Effect, Schema } from "effect";
	import { ContributorsResponseSchema } from "$lib/data/github-contributors";

	import ContributorCard from "$lib/components/custom/contributor-card.sv";

	const FetchContributors = Effect.tryPromise({
		try: async () => {
			const response = await fetch("/api/github/contributors");

			if (!response.ok) {
				throw new Error("Could not load contributors: " + response.status.toString());
			}

			return response.json();
		},
		catch: (cause) => new Error("Could not load contributors: " + String(cause)),
	}).pipe(
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
