import { ClientRuntime } from "svelte-effect-runtime";
import { Layer } from "effect";
import { ProseMediaWidthLive } from "$lib/client/prose-media-width";
import { DiffCodeCardLive } from "$lib/client/diff-code-card";
import { HeadingLinksLive } from "$lib/client/heading-links";
import { CopyButtonLive } from "$lib/client/copy-button";
import { PostHogLive } from "$lib/client/posthog";

const ClientLive = Layer.mergeAll(
	PostHogLive,
	CopyButtonLive,
	DiffCodeCardLive,
	HeadingLinksLive,
	ProseMediaWidthLive,
);

export const init = () => {
	ClientRuntime.make(ClientLive);
};
