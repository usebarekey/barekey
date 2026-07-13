import { Effect } from "effect";
import { Error, Handler } from "svelte-effect-runtime/server";
import { parse as parse_yaml } from "yaml";
import content_meta from "$content/meta.json";
import { get_docs_nav_entry_pairs, type DocsContentMeta } from "$lib/data/docs-content-meta";
import { DecodeFrontmatter } from "$lib/server/markdown/parser";
import type { EntryGenerator, PageServerLoad } from "./$types";

const docs_content_meta = content_meta as DocsContentMeta;
const frontmatter_pattern = /^---\s*[\r\n]([\s\S]*?)[\r\n]---\s*[\r\n]?/;
const raw_modules = import.meta.glob("/src/content/**/*.mdx", {
	import: "default",
	query: "?raw",
}) as Record<string, () => Promise<string>>;

export const entries: EntryGenerator = () =>
	Object.entries(docs_content_meta).flatMap(([category, group]) =>
		get_docs_nav_entry_pairs(group.entries).map(([slug]) => ({ category, slug })),
	);

export const prerender = true;

export const load = Handler<PageServerLoad>(function* ({ params }) {
	const entry = get_docs_nav_entry_pairs(docs_content_meta[params.category]?.entries ?? []).find(
		([slug]) => slug === params.slug,
	)?.[1];
	const source_loader = entry
		? raw_modules[`/src/content/${entry.path.replaceAll("\\", "/")}`]
		: undefined;

	if (!source_loader) {
		return yield* Error("NotFound", "Docs OG image not found.");
	}
	const source = yield* Effect.tryPromise({
		try: source_loader,
		catch: (cause) => new globalThis.Error("Could not load OG docs source", { cause }),
	});
	const frontmatter = frontmatter_pattern.exec(source)?.[1];

	if (!frontmatter) {
		return yield* Error("NotFound", "Docs OG image not found.");
	}
	const parsed_frontmatter = yield* Effect.try({
		try: () => parse_yaml(frontmatter),
		catch: (cause) => new globalThis.Error("Could not parse OG docs frontmatter", { cause }),
	});
	const metadata = yield* DecodeFrontmatter(parsed_frontmatter);

	return {
		description: metadata.description,
		title: metadata.title,
	};
});
