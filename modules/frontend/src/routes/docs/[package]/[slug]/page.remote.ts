import { Render } from "$lib/server/renderer";
import { Effect, Schema } from "effect";
import { Query } from "svelte-effect-runtime";

export const GetPost = Query(
    Schema.Struct({
        package: Schema.String,
        slug: Schema.String
    }),

    ({ package: packageName, slug }) => Effect.gen(function* () {
        return yield* Render(`src/content/${packageName}/${slug}.mdx`);
    })
);
