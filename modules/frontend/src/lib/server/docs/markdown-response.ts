import type { RequestEvent } from "@sveltejs/kit";
import { load_docs_markdown_source } from "$lib/server/docs/markdown-source";

type AcceptRange = {
	media_type: string;
	quality: number;
};

type DocsMarkdownRequestEvent = Pick<RequestEvent, "params" | "request" | "route">;

const docs_route_id = "/docs/[category]/[slug]";

const parse_accept_range = (value: string): AcceptRange => {
	const [media_type, ...parameters] = value.toLowerCase().split(";");
	const quality_parameter = parameters
		.map((parameter) => parameter.trim())
		.find((parameter) => parameter.startsWith("q="));
	const parsed_quality = quality_parameter ? Number(quality_parameter.slice(2)) : 1;
	const quality =
		Number.isFinite(parsed_quality) && parsed_quality >= 0 && parsed_quality <= 1
			? parsed_quality
			: 0;

	return {
		media_type: media_type.trim(),
		quality,
	};
};

const parse_accept = (accept: string | null) =>
	accept?.split(",").map(parse_accept_range) ?? [{ media_type: "*/*", quality: 1 }];

const get_specificity = (range: string, target: string) => {
	const [range_type, range_subtype] = range.split("/");
	const [target_type, target_subtype] = target.split("/");

	if (range_type === target_type && range_subtype === target_subtype) {
		return 2;
	}

	if (range_type === target_type && range_subtype === "*") {
		return 1;
	}

	return range_type === "*" && range_subtype === "*" ? 0 : -1;
};

const get_quality = (ranges: AcceptRange[], target: string) =>
	ranges
		.map((range) => ({
			...range,
			specificity: get_specificity(range.media_type, target),
		}))
		.filter((range) => range.specificity >= 0)
		.sort((left, right) => right.specificity - left.specificity)[0]?.quality ?? 0;

export const accepts_docs_markdown = (accept: string | null) =>
	get_quality(parse_accept(accept), "text/markdown") > 0;

const prefers_docs_markdown = (accept: string | null) => {
	const ranges = parse_accept(accept);
	const explicitly_accepts_markdown = ranges.some(
		(range) => range.media_type === "text/markdown" && range.quality > 0,
	);

	return (
		explicitly_accepts_markdown &&
		get_quality(ranges, "text/markdown") > get_quality(ranges, "text/html")
	);
};

export const handle_docs_markdown_request = async ({
	params,
	request,
	route,
}: DocsMarkdownRequestEvent) => {
	const method = request.method.toUpperCase();

	if (
		route.id !== docs_route_id ||
		(method !== "GET" && method !== "HEAD") ||
		!prefers_docs_markdown(request.headers.get("accept"))
	) {
		return null;
	}

	const markdown = await load_docs_markdown_source({
		category: params.category,
		slug: params.slug,
	});

	if (markdown === null) {
		return null;
	}

	return new Response(method === "HEAD" ? null : markdown, {
		headers: {
			"Content-Type": "text/markdown; charset=utf-8",
			Vary: "Accept",
		},
	});
};
