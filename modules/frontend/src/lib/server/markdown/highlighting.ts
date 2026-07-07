import { Data, Effect } from "effect";
import {
	type BundledLanguage,
	type BundledTheme,
	createHighlighter,
	type Highlighter,
	type LanguageRegistration,
	type ShikiTransformer,
	type ThemedTokenWithVariants,
} from "shiki";
import { textmate as ser_textmate } from "svelte-effect-runtime-grammars";

/**
 * Error raised when Shiki cannot initialize.
 * @since 0.0.1
 */
export class HighlighterInitError extends Data.TaggedError("HighlighterInitError")<{
	message: string;
}> {}

/**
 * Error raised when Shiki cannot load a language grammar.
 * @since 0.0.1
 */
export class CodeLanguageLoadError extends Data.TaggedError("CodeLanguageLoadError")<{
	language: string;
	message: string;
}> {}

/**
 * Error raised when Shiki cannot render highlighted HTML.
 * @since 0.0.1
 */
export class CodeHighlightingError extends Data.TaggedError("CodeHighlightingError")<{
	language: string;
	message: string;
}> {}

const themes = {
	light: "github-light",
	dark: "github-dark",
} satisfies Record<string, BundledTheme>;

const ser_textmate_language = structuredClone(ser_textmate.language) as LanguageRegistration;

const initial_languages = [
	"bash",
	"css",
	"html",
	"js",
	"json",
	"jsx",
	"md",
	"svelte",
	ser_textmate_language,
	"ts",
	"tsx",
	"yaml",
] satisfies (BundledLanguage | LanguageRegistration)[];

const language_aliases = {
	javascript: "js",
	markdown: "md",
	ser: "svelte",
	shell: "bash",
	sh: "bash",
	typescript: "ts",
	yml: "yaml",
} satisfies Record<string, BundledLanguage>;

const plain_text_languages = ["ansi", "plaintext", "text", "txt"] as const;

const diff_language = "diff";
const diff_markers = {
	"++": "inserted",
	"--": "deleted",
} as const;

type DiffMarker = keyof typeof diff_markers;
type DiffLineKind = (typeof diff_markers)[DiffMarker];
type DiffLineStyle = {
	kind: DiffLineKind;
	light?: string;
};

let highlighter: Promise<Highlighter> | undefined;

const GetHighlighter = Effect.tryPromise({
	try: () => {
		highlighter ??= createHighlighter({
			themes: Object.values(themes),
			langs: initial_languages,
		});

		return highlighter;
	},
	catch: (error) =>
		new HighlighterInitError({
			message:
				error instanceof Error ? error.message : "Failed to initialize syntax highlighter.",
		}),
});

const normalize_language = (language: string | null | undefined) => {
	const normalized = language?.trim().toLowerCase();

	if (!normalized) {
		return "text";
	}

	return language_aliases[normalized as keyof typeof language_aliases] ?? normalized;
};

const should_load_language = (highlighter: Highlighter, language: string) => {
	if (plain_text_languages.includes(language as (typeof plain_text_languages)[number])) {
		return false;
	}

	return !highlighter.getLoadedLanguages().includes(language as BundledLanguage);
};

const LoadLanguage = (highlighter: Highlighter, language: string) =>
	Effect.gen(function* () {
		if (!should_load_language(highlighter, language)) {
			return;
		}

		yield* Effect.tryPromise({
			try: () => highlighter.loadLanguage(language as BundledLanguage),
			catch: (error) =>
				new CodeLanguageLoadError({
					language,
					message:
						error instanceof Error ? error.message : "Failed to load code language.",
				}),
		});
	});

const get_diff_marker = (line: string): DiffMarker | undefined => {
	const marker = line.slice(0, 2);

	return marker in diff_markers ? (marker as DiffMarker) : undefined;
};

const is_inline_whitespace = (value: string | undefined) => value === " " || value === "\t";

const strip_diff_marker = (line: string) => {
	const marker = get_diff_marker(line);

	if (!marker) {
		return line;
	}

	const rest = line.slice(marker.length);

	if (rest.length === 1 && is_inline_whitespace(rest)) {
		return "";
	}

	if (is_inline_whitespace(rest[0]) && !is_inline_whitespace(rest[1])) {
		return rest.slice(1);
	}

	return rest;
};

const map_code_lines = (code: string, map_line: (line: string) => string) => {
	const parts = code.split(/(\r?\n)/);

	return parts.map((part, index) => (index % 2 === 0 ? map_line(part) : part)).join("");
};

const strip_diff_markers = (code: string) => map_code_lines(code, strip_diff_marker);

const get_light_variant_color = (tokens: ThemedTokenWithVariants[] | undefined) =>
	tokens?.find((token) => token.variants.light?.color)?.variants.light?.color;

const GetDiffLineStyles = (highlighter: Highlighter, code: string) =>
	Effect.try({
		try: () => {
			const tokens = highlighter.codeToTokensWithThemes(code, {
				lang: diff_language,
				themes,
			});

			return code.split(/\r?\n/).map((line, index): DiffLineStyle | undefined => {
				const marker = get_diff_marker(line);

				if (!marker) {
					return undefined;
				}

				return {
					kind: diff_markers[marker],
					light: get_light_variant_color(tokens[index]),
				};
			});
		},
		catch: (error) =>
			new CodeHighlightingError({
				language: diff_language,
				message: error instanceof Error ? error.message : "Failed to highlight diff code.",
			}),
	});

const create_diff_line_transformer = (
	diff_line_styles: (DiffLineStyle | undefined)[],
): ShikiTransformer => ({
	name: "barekey:diff-lines",
	line(hast, line) {
		const line_style = diff_line_styles[line - 1];

		if (!line_style) {
			return;
		}

		this.addClassToHast(hast, "docs-code-diff-line");
		hast.properties ||= {};
		hast.properties["data-diff"] = line_style.kind;

		const current_style =
			typeof hast.properties.style === "string" ? hast.properties.style : "";
		const diff_style = [line_style.light ? `--shiki-diff-light:${line_style.light}` : undefined]
			.filter(Boolean)
			.join(";");

		if (!diff_style) {
			return;
		}

		hast.properties.style = [current_style, diff_style].filter(Boolean).join(";");
	},
});

const RenderCodeHtml = (
	highlighter: Highlighter,
	code: string,
	language: string,
	transformers?: ShikiTransformer[],
) =>
	Effect.try({
		try: () =>
			highlighter.codeToHtml(code, {
				lang: language as BundledLanguage,
				themes,
				defaultColor: false,
				transformers,
			}),
		catch: (error) =>
			new CodeHighlightingError({
				language,
				message: error instanceof Error ? error.message : "Failed to highlight code.",
			}),
	});

const RenderInlineCodeHtml = (highlighter: Highlighter, code: string, language: string) =>
	Effect.try({
		try: () =>
			highlighter.codeToHtml(code, {
				lang: language as BundledLanguage,
				themes,
				defaultColor: false,
				structure: "inline",
			}),
		catch: (error) =>
			new CodeHighlightingError({
				language,
				message:
					error instanceof Error ? error.message : "Failed to highlight inline code.",
			}),
	});

/**
 * Highlights a code block with the shared dual-theme Shiki renderer.
 * @param input Code and optional language identifier.
 * @returns An Effect resolving to Shiki-rendered HTML.
 * @since 0.0.1
 */
export const HighlightCode = ({
	code,
	diff = false,
	language,
}: {
	code: string;
	diff?: boolean;
	language?: string | null;
}) =>
	Effect.gen(function* () {
		const normalized_language = normalize_language(language);
		const highlighter = yield* GetHighlighter;

		yield* LoadLanguage(highlighter, normalized_language);

		if (!diff) {
			return yield* RenderCodeHtml(highlighter, code, normalized_language);
		}

		yield* LoadLanguage(highlighter, diff_language);

		const diff_line_styles = yield* GetDiffLineStyles(highlighter, code);
		const stripped_code = strip_diff_markers(code);

		return yield* RenderCodeHtml(highlighter, stripped_code, normalized_language, [
			create_diff_line_transformer(diff_line_styles),
		]);
	});

/**
 * Highlights inline code with the shared dual-theme Shiki renderer.
 * @param input Code and language identifier.
 * @returns An Effect resolving to Shiki-rendered inline HTML.
 * @since 0.0.1
 */
export const HighlightInlineCode = ({ code, language }: { code: string; language: string }) =>
	Effect.gen(function* () {
		const normalized_language = normalize_language(language);
		const highlighter = yield* GetHighlighter;

		yield* LoadLanguage(highlighter, normalized_language);

		return yield* RenderInlineCodeHtml(highlighter, code, normalized_language);
	});
