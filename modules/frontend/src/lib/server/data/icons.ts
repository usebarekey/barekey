import type { Component } from "svelte";
import { render } from "svelte/server";
import {
	type FileIconIdentifier,
	get_file_icon_identifier,
} from "$lib/server/data/icon-identifiers";
import {
	SvglBunLogo,
	SvglDenoLogo,
	SvglJavaScriptLogo,
	SvglMarkdownLogo,
	SvglNPMLogo,
	SvglPnpmLogo,
	SvglSvelteLogo,
	SvglTailwindCSSLogo,
	SvglTypeScriptLogo,
	SvglViteLogo,
	SvglVltLogo,
	SvglYarnLogo,
} from "@selemondev/svgl-svelte";
import QuestionMark from "@tabler/icons-svelte/icons/question-mark";

type IconComponent = Component<{
	"aria-hidden"?: boolean;
	class?: string;
	height?: number;
	width?: number;
}>;

const icon_components = new Map<FileIconIdentifier, IconComponent>([
	["bun", SvglBunLogo as IconComponent],
	["deno", SvglDenoLogo as IconComponent],
	["javascript", SvglJavaScriptLogo as IconComponent],
	["markdown", SvglMarkdownLogo as IconComponent],
	["npm", SvglNPMLogo as IconComponent],
	["pnpm", SvglPnpmLogo as IconComponent],
	["svelte", SvglSvelteLogo as IconComponent],
	["tailwindcss", SvglTailwindCSSLogo as IconComponent],
	["typescript", SvglTypeScriptLogo as IconComponent],
	["vite", SvglViteLogo as IconComponent],
	["vlt", SvglVltLogo as IconComponent],
	["yarn", SvglYarnLogo as IconComponent],
]);

const fallback_icon_identifiers = new Set<FileIconIdentifier>(["aube", "nub"]);

const icon_class_modifiers = new Map<FileIconIdentifier, string>([
	["deno", "docs-file-icon-inverted"],
	["vlt", "docs-file-icon-inverted"],
]);

const get_icon_class_name = (icon_identifier: FileIconIdentifier) =>
	["docs-file-icon", icon_class_modifiers.get(icon_identifier)].filter(Boolean).join(" ");

/**
 * Renders the icon associated with a filename or file extension.
 * @param filename Filename to inspect.
 * @returns Rendered SVG markup, or an empty string when no icon matches.
 * @since 0.0.1
 */
export const render_file_icon = (filename: string | undefined) => {
	const icon_identifier = get_file_icon_identifier(filename);

	if (!icon_identifier) {
		return "";
	}

	const icon_component = icon_components.get(icon_identifier);

	if (!icon_component) {
		if (!fallback_icon_identifiers.has(icon_identifier)) {
			return "";
		}

		return render(QuestionMark, {
			props: {
				"aria-hidden": true,
				class: "docs-file-icon docs-file-icon-fallback",
				size: 16,
			},
		}).body;
	}

	return render(icon_component, {
		props: {
			"aria-hidden": true,
			class: get_icon_class_name(icon_identifier),
			height: 16,
			width: 16,
		},
	}).body;
};
