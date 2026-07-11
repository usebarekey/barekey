import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { to_contributors, to_fallback_contributors } from "$lib/server/github/contributors.ts";

test("maps GitHub contributor statistics without a hardcoded contributor snapshot", () => {
	expect(
		to_contributors([
			{
				author: {
					avatar_url: "https://avatars.githubusercontent.com/u/1",
					html_url: "https://github.com/claude",
					login: "claude",
				},
				total: 9,
				weeks: [
					{ a: 12, d: 3 },
					{ a: 8, d: 2 },
				],
			},
		]),
	).toEqual([
		{
			avatar: "https://avatars.githubusercontent.com/u/1",
			commits: 9,
			diff: { minus: 5, plus: 20 },
			is_barekey_member: false,
			name: "claude",
			profile_url: "https://github.com/claude",
		},
	]);
});

test("falls back to immediate contributor and co-author data while stats are computing", () => {
	expect(
		to_fallback_contributors(
			[
				{
					avatar_url: "https://avatars.githubusercontent.com/u/1",
					contributions: 4,
					html_url: "https://github.com/sandersonstabo",
					login: "sandersonstabo",
				},
			],
			{
				items: [
					{
						commit: {
							message:
								"Ship it\n\nCo-Authored-By: Claude Opus 4.7 <noreply@anthropic.com>",
						},
					},
				],
			},
		),
	).toEqual([
		{
			avatar: "https://avatars.githubusercontent.com/u/1",
			commits: 4,
			diff: null,
			is_barekey_member: true,
			name: "sandersonstabo",
			profile_url: "https://github.com/sandersonstabo",
		},
		{
			avatar: "https://avatars.githubusercontent.com/u/81847?v=4",
			commits: 1,
			diff: null,
			is_barekey_member: false,
			name: "claude",
			profile_url: "https://github.com/claude",
		},
	]);
});

test("serves generated contributor data through a dedicated ISR route", () => {
	const route = readFileSync("src/routes/api/github/contributors/+server.ts", "utf8");
	const component = readFileSync("src/lib/components/custom/contributors.sv", "utf8");

	expect(route).toContain("expiration: 3_600");
	expect(route).toContain("FetchGithubContributors");
	expect(component).toContain('fetch("/api/github/contributors")');
	expect(component).toContain("We hit the GitHub rate limit when fetching contributor data.");
});
