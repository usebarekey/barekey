export type FileIconIdentifier =
	| "aube"
	| "bun"
	| "deno"
	| "javascript"
	| "markdown"
	| "npm"
	| "nub"
	| "pnpm"
	| "svelte"
	| "tailwindcss"
	| "typescript"
	| "vite"
	| "vlt"
	| "yarn";

const exact_filename_icon_identifiers = new Map<string, FileIconIdentifier>([
	["bun.lock", "bun"],
	["deno.json", "deno"],
	["deno.jsonc", "deno"],
	["deno.lock", "deno"],
	["svelte.config.js", "svelte"],
	["svelte.config.ts", "svelte"],
	["tailwind.config.cjs", "tailwindcss"],
	["tailwind.config.js", "tailwindcss"],
	["tailwind.config.mjs", "tailwindcss"],
	["tailwind.config.ts", "tailwindcss"],
	["vite.config.js", "vite"],
	["vite.config.mjs", "vite"],
	["vite.config.mts", "vite"],
	["vite.config.ts", "vite"],
]);

const extension_icon_identifiers = new Map<string, FileIconIdentifier>([
	["cjs", "javascript"],
	["cts", "typescript"],
	["js", "javascript"],
	["jsx", "javascript"],
	["markdown", "markdown"],
	["md", "markdown"],
	["mdx", "markdown"],
	["mjs", "javascript"],
	["mts", "typescript"],
	["svelte", "svelte"],
	["ts", "typescript"],
	["tsx", "typescript"],
]);

const named_icon_identifiers = new Map<string, FileIconIdentifier>([
	["aube", "aube"],
	["bun", "bun"],
	["deno", "deno"],
	["javascript", "javascript"],
	["js", "javascript"],
	["markdown", "markdown"],
	["md", "markdown"],
	["npm", "npm"],
	["nub", "nub"],
	["pnpm", "pnpm"],
	["svelte", "svelte"],
	["tailwind", "tailwindcss"],
	["tailwindcss", "tailwindcss"],
	["typescript", "typescript"],
	["ts", "typescript"],
	["vite", "vite"],
	["vlt", "vlt"],
	["yarn", "yarn"],
]);

const normalize_filename = (filename: string) =>
	filename.trim().toLowerCase().split(/[/\\]/).at(-1) ?? "";

const get_file_extension = (filename: string) => {
	const extension = filename.split(".").at(-1);

	return extension === filename ? undefined : extension;
};

export const get_file_icon_identifier = (filename: string | undefined) => {
	if (!filename) {
		return;
	}

	const normalized = normalize_filename(filename);
	return (
		exact_filename_icon_identifiers.get(normalized) ??
		named_icon_identifiers.get(normalized) ??
		extension_icon_identifiers.get(get_file_extension(normalized) ?? "")
	);
};
