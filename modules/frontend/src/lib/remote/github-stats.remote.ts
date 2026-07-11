import { Effect } from "effect";
import { Query } from "svelte-effect-runtime";

import sharp from "sharp";

const dominant_color_cache = new Map<string, Promise<string>>();
const fallback_dominant_color = "#18181b";
const github_contributors = [
	{
		avatar: "https://avatars.githubusercontent.com/u/69873514?v=4",
		is_barekey_member: true,
		commits: 441,
		diff: {
			minus: 113_879,
			plus: 155_841,
		},
		name: "sandersonstabo",
	},
	{
		avatar: "https://github.com/aurorarissime.png",
		is_barekey_member: false,
		commits: 1,
		diff: {
			minus: 1,
			plus: 1,
		},
		name: "aurorarissime",
	},
];

const channel_to_hex = (channel: number) => channel.toString(16).padStart(2, "0");

const rgb_to_hex = (red: number, green: number, blue: number) =>
	`#${channel_to_hex(red)}${channel_to_hex(green)}${channel_to_hex(blue)}`;

const calculate_dominant_color = (avatar: string) => {
	const cached_color = dominant_color_cache.get(avatar);

	if (cached_color) {
		return cached_color;
	}

	const color = fetch(avatar)
		.then((response) => {
			if (!response.ok) {
				throw new Error(`Could not fetch contributor avatar: ${response.status}`);
			}

			return response.arrayBuffer();
		})
		.then((avatar_buffer) => sharp(avatar_buffer).stats())
		.then(({ dominant }) => rgb_to_hex(dominant.r, dominant.g, dominant.b))
		.catch(() => fallback_dominant_color);

	dominant_color_cache.set(avatar, color);

	return color;
};

const github_stats = Effect.promise(async () => ({
	contributors: await Promise.all(
		github_contributors.map(async (contributor) => ({
			...contributor,
			dominant_color: await calculate_dominant_color(contributor.avatar),
		})),
	),
}));

export const FetchGithubStats = Query(github_stats);
