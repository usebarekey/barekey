import { read } from "$app/server";
import { error } from "@sveltejs/kit";
import { CustomFont, resolveFonts } from "@ethercorps/sveltekit-og/fonts";
import { ImageResponse } from "@ethercorps/sveltekit-og";
import logo_url from "$lib/assets/barekey/logo.png?url";
import cal_sans_url from "$lib/assets/fonts/calsans/calsans-bold.ttf?url";
import geist_url from "$lib/assets/fonts/geist/geist-600.ttf?url";
import pp_neue_montreal_regular_url from "$lib/assets/fonts/neue-montreal/pp-neue-montreal-regular.otf?url";
import { get_docs_entries, load_docs_content, type DocsRoute } from "$lib/server/docs/content";
import OgCard from "$lib/components/og/og-card.sv";
import type { EntryGenerator, RequestHandler } from "./$types";

const image_size = {
	height: 630,
	width: 1200,
};

let logo_src_promise: Promise<string> | undefined;
let fonts_promise: ReturnType<typeof resolveFonts> | undefined;

const encode_base64 = (array_buffer: ArrayBuffer) => {
	const bytes = new Uint8Array(array_buffer);
	const chunk_size = 0x8000;
	let binary = "";

	for (let index = 0; index < bytes.length; index += chunk_size) {
		binary += String.fromCharCode(...bytes.subarray(index, index + chunk_size));
	}

	return btoa(binary);
};

const get_logo_src = () =>
	(logo_src_promise ??= read(logo_url)
		.arrayBuffer()
		.then((buffer) => `data:image/png;base64,${encode_base64(buffer)}`));

const get_og_fonts = () =>
	(fonts_promise ??= resolveFonts([
		new CustomFont("PP Neue Montreal", () => read(pp_neue_montreal_regular_url).arrayBuffer(), {
			weight: 400,
		}),
		new CustomFont("Geist", () => read(geist_url).arrayBuffer(), {
			weight: 600,
		}),
		new CustomFont("Cal Sans", () => read(cal_sans_url).arrayBuffer(), {
			weight: 700,
		}),
	]));

export const entries: EntryGenerator = async () => {
	const routes = await Promise.all(
		get_docs_entries().map(async (route) => {
			const docs_content = await load_docs_content(route);

			return docs_content?.has_frontmatter ? route : undefined;
		}),
	);

	return routes.filter((route): route is DocsRoute => route !== undefined);
};

export const prerender = true;

export const GET: RequestHandler = async ({ params }) => {
	const docs_content = await load_docs_content({
		category: params.category,
		slug: params.slug,
	});

	if (!docs_content || !docs_content.has_frontmatter) {
		error(404, "Docs OG image not found.");
	}

	const [fonts, logo_src] = await Promise.all([get_og_fonts(), get_logo_src()]);

	return new ImageResponse(
		OgCard,
		{
			...image_size,
			fonts,
		},
		{
			description: docs_content.metadata.description,
			kind: "docs",
			logo_src,
			title: docs_content.metadata.title,
		},
	);
};
