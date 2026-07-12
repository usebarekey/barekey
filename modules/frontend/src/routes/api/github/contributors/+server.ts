import type { Config } from "@sveltejs/adapter-vercel";
import { Handler } from "svelte-effect-runtime/server";
import { Effect } from "effect";
import { json } from "@sveltejs/kit";
import { FetchGithubContributors } from "$lib/server/github/contributors";
import type { RequestHandler } from "./$types";

export const config: Config = {
	isr: {
		expiration: 3_600,
	},
	split: true,
};

export const prerender = false;

export const GET = Handler<RequestHandler>(function* () {
	const contributors = yield* FetchGithubContributors.pipe(Effect.orDie);

	return json({ contributors });
});
