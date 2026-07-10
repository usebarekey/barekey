import { ServerRuntime } from "svelte-effect-runtime";
import { NodeFileSystem } from "@effect/platform-node";
import type { Handle, ServerInit } from "@sveltejs/kit";
import { handle_docs_markdown_request } from "$lib/server/docs/markdown-response";

export const handle: Handle = async ({ event, resolve }) => {
	const markdown_response = await handle_docs_markdown_request(event);

	return markdown_response ?? resolve(event);
};

/**
 * Initializes the server-side Effect runtime with the Node filesystem layer.
 * @returns Nothing.
 * @since 0.0.1
 */
export const init: ServerInit = () => {
	ServerRuntime.make(NodeFileSystem.layer);
};
