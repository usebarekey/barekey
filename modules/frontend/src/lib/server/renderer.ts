import { Data, Effect } from "effect";
import { FileSystem } from "effect/FileSystem";
import { markdownToHtml } from "satteri";

export class InternalRendererError extends Data.TaggedError("InternalRendererError")<{
    message: string;
}> {}

export const Render = (path: string) => Effect.gen(function* () {
    const fs = yield* FileSystem;
    const txt = yield* fs.readFileString(path);
    
    const { html, frontmatter } = yield* Effect.try({
        try: () => markdownToHtml(txt, {
            features: {
                gfm: true,
                frontmatter: true,
                math: false
            }
        }),
        catch: (error) => new InternalRendererError({
            message: error instanceof Error ? error.message : "Unknown error."
        })
    });

    return {
        html,
        frontmatter
    }
});