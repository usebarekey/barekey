import content_meta from "$content/meta.json";
import { Effect, Option } from "effect";
import { get_docs_nav_entry_pairs, type DocsContentMeta } from "$lib/data/docs-content-meta";

export type DocsRoute = {
	category: string;
	slug: string;
};

const docs_content_meta = content_meta as DocsContentMeta;

const raw_modules = import.meta.glob("/src/content/**/*.mdx", {
	import: "default",
	query: "?raw",
}) as Record<string, () => Promise<string>>;

const get_content_path = ({ category, slug }: DocsRoute) => {
	const entry = get_docs_nav_entry_pairs(docs_content_meta[category]?.entries ?? []).find(
		([entry_slug]) => entry_slug === slug,
	)?.[1];

	return Option.fromUndefinedOr(
		entry ? `/src/content/${entry.path.replaceAll("\\", "/")}` : undefined,
	);
};

export const LoadDocsMarkdownSource = (route: DocsRoute) =>
	Effect.gen(function* () {
		const configured_content_path = get_content_path(route);
		const direct_content_path = `/src/content/${route.category}/${route.slug}.mdx`;
		const raw_loader = [...Option.toArray(configured_content_path), direct_content_path]
			.map((content_path) => raw_modules[content_path])
			.find(Boolean);

		if (!raw_loader) {
			return Option.none<string>();
		}

		const markdown = yield* Effect.tryPromise({
			try: raw_loader,
			catch: (cause) => new Error("Could not load docs markdown source", { cause }),
		});

		return Option.some(markdown);
	});
