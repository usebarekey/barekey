<script lang="ts">
	import { FetchGithubStats } from "$lib/remote/github-stats.remote";

	import ContributorCard from "$lib/components/custom/contributor-card.sv";
</script>

{#await yield* FetchGithubStats()}
	<p>Loading contributors...</p>
{:then stats}
	<ul class="not-prose space-y-2">
		{#each stats.contributors as contributor}
			<ContributorCard {contributor} />
		{/each}
	</ul>
{/await}
