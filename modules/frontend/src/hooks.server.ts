import type { ServerInit } from "@sveltejs/kit";
import { NodeFileSystem } from "@effect/platform-node";
import { ServerRuntime } from "svelte-effect-runtime";

/**
 * Initializes the server-side Effect runtime with the Node filesystem layer.
 * @returns Nothing.
 * @since 0.0.1
 */
export const init: ServerInit = () => {
	ServerRuntime.make(NodeFileSystem.layer);
};
