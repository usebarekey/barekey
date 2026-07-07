import { Effect, Schema } from "effect";
import { Query } from "svelte-effect-runtime/server";
import { Render } from "$lib/server/markdown/renderer";

const content_segment_schema = Schema.NonEmptyString.pipe(
	Schema.check(Schema.isPattern(/^[a-z0-9-]+$/)),
);

const get_post_params_schema = Schema.Struct({
	category: content_segment_schema,
	slug: content_segment_schema,
});

/**
 * Fetches and renders a docs post from a validated content path.
 * @returns A remote query resolving to rendered post content.
 * @since 0.0.1
 */
export const GetPost = Query(get_post_params_schema, ({ category, slug }) =>
	Effect.gen(function* () {
		return yield* Render(`$content/${category}/${slug}.mdx`);
	}),
);
