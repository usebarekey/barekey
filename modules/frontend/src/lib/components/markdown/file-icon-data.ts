import type { FileIconIdentifier } from "$lib/data/icon-identifiers";

export type SvglIconName =
	| "Bun"
	| "Deno"
	| "JavaScript"
	| "Markdown"
	| "NPM"
	| "Pnpm"
	| "Svelte"
	| "TailwindCSS"
	| "TypeScript"
	| "Vite"
	| "Vlt"
	| "Yarn";

const file_icon_svgl_names = {
	bun: "Bun",
	deno: "Deno",
	javascript: "JavaScript",
	markdown: "Markdown",
	npm: "NPM",
	pnpm: "Pnpm",
	svelte: "Svelte",
	tailwindcss: "TailwindCSS",
	typescript: "TypeScript",
	vite: "Vite",
	vlt: "Vlt",
	yarn: "Yarn",
} satisfies Partial<Record<FileIconIdentifier, SvglIconName>>;

const file_icon_labels = {
	aube: "A",
	bun: "B",
	deno: "D",
	javascript: "J",
	markdown: "M",
	npm: "N",
	nub: "N",
	pnpm: "P",
	svelte: "S",
	tailwindcss: "T",
	typescript: "T",
	vite: "V",
	vlt: "V",
	yarn: "Y",
} satisfies Record<FileIconIdentifier, string>;

export const get_svgl_icon_name = (icon_identifier: FileIconIdentifier | undefined) =>
	icon_identifier ? file_icon_svgl_names[icon_identifier] : undefined;

export const get_file_icon_label = (icon_identifier: FileIconIdentifier) =>
	file_icon_labels[icon_identifier];
