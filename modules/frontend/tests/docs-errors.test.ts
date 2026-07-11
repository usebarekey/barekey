import { expect, test } from "vitest";
import content_meta from "$content/meta.json";
import { get_docs_nav_entry_pairs, type DocsContentMeta } from "$lib/data/docs-content-meta";
import { ser_error_names } from "$lib/data/ser-error-names";

const docs_meta = content_meta as DocsContentMeta;
const ser_groups = docs_meta.ser?.entries ?? [];
const error_group_index = ser_groups.findIndex((group) => group.name === "Errors");
const error_groups = ser_groups.slice(error_group_index);
const error_group = error_groups.at(0);
const error_pages = import.meta.glob("/src/content/ser/errors/*.mdx", {
	import: "default",
	query: "?raw",
});

const expected_error_groups = [
	["FormError", "RemoteValidationError", "RemoteHttpError", "RemoteTransportError"],
	[
		"RuntimeError",
		"PreprocessError",
		"AwaitInEffectWorkError",
		"AsyncEffectInSyncRuneError",
		"AsyncEffectInEventCallbackError",
		"YieldStarInEventCallbackError",
		"UnsupportedMarkupEffectPositionError",
	],
	[
		"RequestEventUnavailableError",
		"UncheckedQueryHandlerMissingError",
		"BatchQueryHandlerMissingError",
		"UncheckedLiveQueryHandlerMissingError",
		"UncheckedCommandHandlerMissingError",
		"UncheckedFormHandlerMissingError",
		"UncheckedPrerenderHandlerMissingError",
		"InvalidLiveQueryReturnError",
		"EmptyStreamYieldError",
	],
	["DispatcherDisposedError", "RuntimeAlreadyInitializedError"],
	["InvalidQueryFactoryError", "InvalidLiveQueryFactoryError", "InvalidCommandFactoryError"],
	[
		"RemoteFormEndpointMissingError",
		"InvalidRemoteFormResponseError",
		"UnsupportedRemoteFormResponseError",
		"RemoteErrorDecodeError",
	],
	[
		"ServerOnlyImportError",
		"SvelteKitServerExportUnavailableError",
		"RemoteHelperContextError",
		"RemoteHelperError",
	],
];

const expected_error_categories = [
	"Remote failures",
	"Compiler and markup",
	"Remote handlers",
	"Runtime lifecycle",
	"Factory calls",
	"Form transport",
	"Integration",
];

test("Errors is the final named collapsible SER group", () => {
	expect(error_group?.name).toBe("Errors");
	expect(error_group?.collapsible).toBe(true);
	expect(
		ser_groups.slice(0, error_group_index).every((group) => group.collapsible !== true),
	).toBe(true);
	expect(error_groups.slice(1).every((group) => group.name === undefined)).toBe(true);
});

test("related SER errors are separated into anonymous groups", () => {
	const configured_error_groups = error_groups.map((group) =>
		get_docs_nav_entry_pairs([group]).map(([, entry]) => entry.name),
	);

	expect(error_groups.map((group) => group.category)).toEqual(expected_error_categories);
	expect(configured_error_groups).toEqual(expected_error_groups);
});

test("every configured SER error has its own page", () => {
	const entries = get_docs_nav_entry_pairs(error_groups);
	const configured_names = entries.map(([, entry]) => entry.name);

	expect(configured_names).toEqual(ser_error_names);
	expect(Object.keys(error_pages)).toHaveLength(ser_error_names.length);

	for (const [, entry] of entries) {
		expect(error_pages[`/src/content/${entry.path}`]).toBeTypeOf("function");
	}
});

test("SER error source references are complete and free of migration artifacts", async () => {
	const pages = await Promise.all(Object.values(error_pages).map((load_page) => load_page()));
	const content = pages.join("\n");
	const source_locations = content.match(
		/line="\d+" char="\d+" link="https:\/\/github\.com\/usebarekey\/svelte-effect-runtime\/blob\/55b22b5afcfecf1a5643c5e26f7088fae6a22a6e\/modules\/svelte-effect-runtime\/src\/[^\"]+\.ts#L\d+"/g,
	);

	expect(source_locations).toHaveLength(105);
	expect(content).not.toMatch(/tokens truncated|â€¦/u);
});
