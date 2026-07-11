import { env } from "$env/dynamic/private";
import { Effect, Schema } from "effect";
import type { Contributor } from "$lib/data/github-contributors";

const repository_owner = "usebarekey";
const repository_name = "svelte-effect-runtime";
const known_barekey_members = new Set(["sandersonstabo"]);

const GitHubContributorStatsSchema = Schema.Array(
	Schema.Struct({
		author: Schema.NullOr(
			Schema.Struct({
				avatar_url: Schema.String,
				html_url: Schema.String,
				login: Schema.String,
			}),
		),
		total: Schema.Number,
		weeks: Schema.Array(
			Schema.Struct({
				a: Schema.Number,
				d: Schema.Number,
			}),
		),
	}),
);

type GitHubContributorStats = typeof GitHubContributorStatsSchema.Type;

const github_token = env.GITHUB_TOKEN ?? env.GH_TOKEN;
const github_headers: Record<string, string> = {
	Accept: "application/vnd.github+json",
	"User-Agent": "barekey-docs",
	"X-GitHub-Api-Version": "2022-11-28",
};

if (github_token) {
	github_headers.Authorization = "Bearer " + github_token;
}

export const to_contributors = (stats: GitHubContributorStats): Contributor[] =>
	stats
		.flatMap((stat) => {
			if (!stat.author) return [];

			return [
				{
					avatar: stat.author.avatar_url,
					commits: stat.total,
					diff: stat.weeks.reduce(
						(diff, week) => ({
							minus: diff.minus + week.d,
							plus: diff.plus + week.a,
						}),
						{ minus: 0, plus: 0 },
					),
					is_barekey_member: known_barekey_members.has(stat.author.login.toLowerCase()),
					name: stat.author.login,
					profile_url: stat.author.html_url,
				},
			];
		})
		.sort((left, right) => right.commits - left.commits);

export const FetchGithubContributors = Effect.gen(function* () {
	const response = yield* Effect.tryPromise({
		try: async () => {
			let github_response: Response;

			for (let attempt = 0; ; attempt += 1) {
				github_response = await fetch(
					"https://api.github.com/repos/" +
						repository_owner +
						"/" +
						repository_name +
						"/stats/contributors",
					{ headers: github_headers },
				);

				if (github_response.status !== 202 || attempt >= 3) break;

				await new Promise((resolve) => setTimeout(resolve, 250 * (attempt + 1)));
			}

			return github_response;
		},
		catch: (cause) => new Error("Could not fetch GitHub contributors: " + String(cause)),
	});

	if (!response.ok) {
		return yield* Effect.fail(
			new Error("GitHub returned " + response.status.toString() + " for contributor stats"),
		);
	}

	const value = yield* Effect.tryPromise({
		try: () => response.json(),
		catch: (cause) => new Error("Could not read GitHub contributors: " + String(cause)),
	});
	const stats = yield* Schema.decodeUnknownEffect(GitHubContributorStatsSchema)(value);

	return to_contributors(stats);
});
