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

const GitHubGraphResponseSchema = Schema.Struct({
	data: Schema.Struct({
		repository: Schema.NullOr(
			Schema.Struct({
				defaultBranchRef: Schema.NullOr(
					Schema.Struct({
						target: Schema.Struct({
							history: Schema.Struct({
								nodes: Schema.Array(
									Schema.Struct({
										additions: Schema.Number,
										authors: Schema.Struct({
											nodes: Schema.Array(
												Schema.Struct({
													email: Schema.String,
													name: Schema.String,
													user: Schema.NullOr(GitHubAuthorSchema),
												}),
											),
										}),
										deletions: Schema.Number,
									}),
								),
								pageInfo: Schema.Struct({
									endCursor: Schema.NullOr(Schema.String),
									hasNextPage: Schema.Boolean,
								}),
							}),
						}),
					}),
				),
			}),
		),
	}),
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

const github_graph_query = [
	"query Contributors($owner: String!, $name: String!, $cursor: String) {",
	"  repository(owner: $owner, name: $name) {",
	"    defaultBranchRef {",
	"      target {",
	"        ... on Commit {",
	"          history(first: 100, after: $cursor) {",
	"            pageInfo { endCursor hasNextPage }",
	"            nodes {",
	"              additions",
	"              deletions",
	"              authors(first: 10) {",
	"                nodes {",
	"                  email",
	"                  name",
	"                  user { login avatar_url: avatarUrl html_url: url }",
	"                }",
	"              }",
	"            }",
	"          }",
	"        }",
	"      }",
	"    }",
	"  }",
	"}",
].join("\n");

const FetchGraphqlContributors = Effect.gen(function* () {
	if (!github_token) {
		return yield* Effect.fail(new Error("GitHub GraphQL requires GITHUB_TOKEN"));
	}

	const contributors = new Map<string, Contributor>();
	let cursor: string | null = null;

	for (;;) {
		const response = yield* Effect.tryPromise({
			try: () =>
				fetch("https://api.github.com/graphql", {
					method: "POST",
					headers: {
						...github_headers,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({
						query: github_graph_query,
						variables: {
							cursor,
							name: repository_name,
							owner: repository_owner,
						},
					}),
				}),
			catch: (cause) =>
				new Error("Could not fetch GitHub contributor history: " + String(cause)),
		});
		const value = yield* ReadGithubJson(response);
		const graph = yield* Schema.decodeUnknownEffect(GitHubGraphResponseSchema)(value);
		const history = graph.data.repository?.defaultBranchRef?.target.history;

		if (!history) {
			return yield* Effect.fail(new Error("GitHub default branch history is unavailable"));
		}

		for (const commit of history.nodes) {
			const commit_authors = new Set<string>();

			for (const author of commit.authors.nodes) {
				const known_profile = known_coauthor_profiles.get(author.email.toLowerCase());
				const key =
					author.user?.login.toLowerCase() ??
					known_profile?.key ??
					"email:" + author.email;

				if (commit_authors.has(key)) continue;
				commit_authors.add(key);

				const contributor = contributors.get(key) ?? {
					avatar: author.user?.avatar_url ?? known_profile?.avatar ?? null,
					commits: 0,
					diff: { minus: 0, plus: 0 },
					is_barekey_member: known_barekey_members.has(key),
					name: author.user?.login ?? known_profile?.name ?? author.name,
					profile_url: author.user?.html_url ?? known_profile?.profile_url ?? null,
				};
				contributors.set(key, {
					...contributor,
					commits: contributor.commits + 1,
					diff: {
						minus: (contributor.diff?.minus ?? 0) + commit.deletions,
						plus: (contributor.diff?.plus ?? 0) + commit.additions,
					},
				});
			}
		}

		if (!history.pageInfo.hasNextPage) break;
		cursor = history.pageInfo.endCursor;
	}

	return Array.from(contributors.values()).sort((left, right) => right.commits - left.commits);
});

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
		return yield* github_token ? FetchGraphqlContributors : FetchFallbackContributors;
	}

	const value = yield* ReadGithubJson(response);
	const stats = yield* Schema.decodeUnknownEffect(GitHubContributorStatsSchema)(value);

	return to_contributors(stats);
});
