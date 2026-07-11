import { env } from "$env/dynamic/private";
import { Effect, Schema } from "effect";
import type { Contributor } from "$lib/data/github-contributors";

const repository_owner = "usebarekey";
const repository_name = "svelte-effect-runtime";
const repository_path = "/repos/" + repository_owner + "/" + repository_name;
const known_barekey_members = new Set(["sandersonstabo"]);
const known_coauthor_profiles = new Map([
	[
		"noreply@anthropic.com",
		{
			avatar: "https://avatars.githubusercontent.com/u/81847?v=4",
			key: "claude",
			name: "claude",
			profile_url: "https://github.com/claude",
		},
	],
	[
		"ss@barekey.dev",
		{
			avatar: "https://avatars.githubusercontent.com/u/69873514?v=4",
			key: "sandersonstabo",
			name: "sandersonstabo",
			profile_url: "https://github.com/sandersonstabo",
		},
	],
]);

const GitHubAuthorSchema = Schema.Struct({
	avatar_url: Schema.String,
	html_url: Schema.String,
	login: Schema.String,
});

const GitHubContributorStatsSchema = Schema.Array(
	Schema.Struct({
		author: Schema.NullOr(GitHubAuthorSchema),
		total: Schema.Number,
		weeks: Schema.Array(
			Schema.Struct({
				a: Schema.Number,
				d: Schema.Number,
			}),
		),
	}),
);

const GitHubContributorListSchema = Schema.Array(
	Schema.Struct({
		avatar_url: Schema.String,
		contributions: Schema.Number,
		html_url: Schema.String,
		login: Schema.String,
	}),
);

const GitHubCommitSearchSchema = Schema.Struct({
	items: Schema.Array(
		Schema.Struct({
			commit: Schema.Struct({
				message: Schema.String,
			}),
		}),
	),
});

type GitHubContributorStats = typeof GitHubContributorStatsSchema.Type;
type GitHubContributorList = typeof GitHubContributorListSchema.Type;
type GitHubCommitSearch = typeof GitHubCommitSearchSchema.Type;

const github_token = env.GITHUB_TOKEN ?? env.GH_TOKEN;
const github_headers: Record<string, string> = {
	Accept: "application/vnd.github+json",
	"User-Agent": "barekey-docs",
	"X-GitHub-Api-Version": "2022-11-28",
};

if (github_token) {
	github_headers.Authorization = "Bearer " + github_token;
}

const FetchGithubResponse = (path: string) =>
	Effect.tryPromise({
		try: () => fetch("https://api.github.com" + path, { headers: github_headers }),
		catch: (cause) => new Error("Could not fetch GitHub contributors: " + String(cause)),
	});

const ReadGithubJson = (response: Response) =>
	Effect.gen(function* () {
		if (!response.ok) {
			return yield* Effect.fail(new Error("GitHub returned " + response.status.toString()));
		}

		return yield* Effect.tryPromise({
			try: () => response.json(),
			catch: (cause) => new Error("Could not read GitHub contributors: " + String(cause)),
		});
	});

const extract_coauthors = (message: string) =>
	Array.from(message.matchAll(/^co-authored-by:\s*(.+?)\s*<([^>]+)>\s*$/gim), (match) => ({
		email: match[2]!.trim().toLowerCase(),
		name: match[1]!.trim(),
	}));

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

export const to_fallback_contributors = (
	contributor_list: GitHubContributorList,
	commit_search: GitHubCommitSearch,
): Contributor[] => {
	const contributors = new Map<string, Contributor>(
		contributor_list.map((contributor) => [
			contributor.login.toLowerCase(),
			{
				avatar: contributor.avatar_url,
				commits: contributor.contributions,
				diff: null,
				is_barekey_member: known_barekey_members.has(contributor.login.toLowerCase()),
				name: contributor.login,
				profile_url: contributor.html_url,
			},
		]),
	);

	for (const item of commit_search.items) {
		const commit_coauthors = new Set<string>();

		for (const coauthor of extract_coauthors(item.commit.message)) {
			const known_profile = known_coauthor_profiles.get(coauthor.email);
			const key = known_profile?.key ?? "email:" + coauthor.email;

			if (commit_coauthors.has(key)) continue;
			commit_coauthors.add(key);

			const contributor = contributors.get(key) ?? {
				avatar: known_profile?.avatar ?? null,
				commits: 0,
				diff: null,
				is_barekey_member: known_barekey_members.has(key),
				name: known_profile?.name ?? coauthor.name,
				profile_url: known_profile?.profile_url ?? null,
			};
			contributors.set(key, {
				...contributor,
				commits: contributor.commits + 1,
			});
		}
	}

	return Array.from(contributors.values()).sort((left, right) => right.commits - left.commits);
};

const FetchFallbackContributors = Effect.gen(function* () {
	const search_query = new URLSearchParams({
		per_page: "100",
		q: "repo:" + repository_owner + "/" + repository_name + ' "Co-Authored-By:"',
	});
	const [contributors_response, commits_response] = yield* Effect.all(
		[
			FetchGithubResponse(repository_path + "/contributors?per_page=100"),
			FetchGithubResponse("/search/commits?" + search_query.toString()),
		],
		{ concurrency: "unbounded" },
	);
	const [contributors_value, commits_value] = yield* Effect.all(
		[ReadGithubJson(contributors_response), ReadGithubJson(commits_response)],
		{ concurrency: "unbounded" },
	);
	const contributor_list = yield* Schema.decodeUnknownEffect(GitHubContributorListSchema)(
		contributors_value,
	);
	const commit_search =
		yield* Schema.decodeUnknownEffect(GitHubCommitSearchSchema)(commits_value);

	return to_fallback_contributors(contributor_list, commit_search);
});

export const FetchGithubContributors = Effect.gen(function* () {
	const response = yield* FetchGithubResponse(repository_path + "/stats/contributors");

	if (response.status === 202) {
		return yield* FetchFallbackContributors;
	}

	const value = yield* ReadGithubJson(response);
	const stats = yield* Schema.decodeUnknownEffect(GitHubContributorStatsSchema)(value);

	return to_contributors(stats);
});
