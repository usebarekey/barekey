import { ServerRuntime } from "svelte-effect-runtime/server";
import { NodeFileSystem } from "@effect/platform-node";
import type { Handle, ServerInit } from "@sveltejs/kit";
import { Effect, Option } from "effect";
import { HandleDocsMarkdownRequest } from "$lib/server/docs/markdown-response";

export const handle: Handle = ({ event, resolve }) =>
	Effect.runPromise(
		Effect.gen(function* () {
			const markdown_response = yield* HandleDocsMarkdownRequest(event).pipe(Effect.orDie);

			if (Option.isSome(markdown_response)) {
				return markdown_response.value;
			}

			return yield* Effect.promise(async () => resolve(event));
		}),
	);

export const init: ServerInit = () => {
	ServerRuntime.make(NodeFileSystem.layer);
};
