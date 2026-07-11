import { Data, Effect } from "effect";
import { textmate as ser_textmate } from "svelte-effect-runtime-grammars";
import { component_prop_expression, render_component_tag } from "./components/component-tags";
import {
	type BundledLanguage,
	type BundledTheme,
	createHighlighter,
	type Highlighter,
	type LanguageRegistration,
	type ShikiTransformer,
	type ThemedTokenWithVariants,
} from "shiki";

/** Error raised when Shiki cannot initialize. */
export class HighlighterInitError extends Data.TaggedError("HighlighterInitError")<{
	message: string;
}> {}

/** Error raised when Shiki cannot load a language grammar. */
export class CodeLanguageLoadError extends Data.TaggedError("CodeLanguageLoadError")<{
	language: string;
	message: string;
}> {}

/** Error raised when Shiki cannot render highlighted HTML. */
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
type DiffLineNeighbor = "longer" | "same" | "shorter";
type DiffLinePosition = "end" | "middle" | "single" | "start";
type DiffLineStyle = {
	kind: DiffLineKind;
	light?: string;
	next_relation?: DiffLineNeighbor;
	position: DiffLinePosition;
	previous_relation?: DiffLineNeighbor;
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

const normalize_inline_language = (language: string, code: string) => {
	const normalized = language.trim().toLowerCase();
	const has_markup_context = /^\s*[<{]/.test(code);

	if (normalized === "ser" && !has_markup_context) {
		return "ts";
	}

	return normalize_language(language);
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

const get_diff_line_kind = (line: string): DiffLineKind | undefined => {
	const marker = get_diff_marker(line);

	return marker ? diff_markers[marker] : undefined;
};

const get_line_columns = (line: string) => {
	let columns = 0;

	for (const character of line) {
		columns += character === "\t" ? 2 : 1;
	}

	return columns;
};

const get_diff_line_position = (
	diff_line_kinds: (DiffLineKind | undefined)[],
	index: number,
): DiffLinePosition => {
	const kind = diff_line_kinds[index];
	const matches_previous = diff_line_kinds[index - 1] === kind;
	const matches_next = diff_line_kinds[index + 1] === kind;

	if (matches_previous && matches_next) {
		return "middle";
	}

	if (matches_previous) {
		return "end";
	}

	if (matches_next) {
		return "start";
	}

	return "single";
};

const get_diff_line_neighbor = (
	diff_line_kinds: (DiffLineKind | undefined)[],
	diff_line_columns: number[],
	index: number,
	neighbor_index: number,
): DiffLineNeighbor | undefined => {
	const kind = diff_line_kinds[index];

	if (!kind || diff_line_kinds[neighbor_index] !== kind) {
		return undefined;
	}

	const columns = diff_line_columns[index];
	const neighbor_columns = diff_line_columns[neighbor_index];

	if (neighbor_columns < columns) {
		return "shorter";
	}

	if (neighbor_columns > columns) {
		return "longer";
	}

	return "same";
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
			const lines = code.split(/\r?\n/);
			const diff_line_kinds = lines.map(get_diff_line_kind);
			const diff_line_columns = lines.map((line) =>
				get_line_columns(strip_diff_marker(line)),
			);

			return lines.map((line, index): DiffLineStyle | undefined => {
				const kind = get_diff_line_kind(line);
				const next_relation = get_diff_line_neighbor(
					diff_line_kinds,
					diff_line_columns,
					index,
					index + 1,
				);
				const previous_relation = get_diff_line_neighbor(
					diff_line_kinds,
					diff_line_columns,
					index,
					index - 1,
				);

				if (!kind) {
					return undefined;
				}

				return {
					kind,
					light: get_light_variant_color(tokens[index]),
					next_relation,
					position: get_diff_line_position(diff_line_kinds, index),
					previous_relation,
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
		hast.properties["data-diff-position"] = line_style.position;
		if (line_style.previous_relation) {
			hast.properties["data-diff-previous"] = line_style.previous_relation;
		}
		if (line_style.next_relation) {
			hast.properties["data-diff-next"] = line_style.next_relation;
		}

		const current_style =
			typeof hast.properties.style === "string" ? hast.properties.style : "";
		const diff_style = line_style.light ? `--shiki-diff-light:${line_style.light}` : undefined;

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

const render_inline_token_style = (token: ThemedTokenWithVariants) =>
	[
		token.variants.light.color ? `--shiki-light:${token.variants.light.color}` : undefined,
		token.variants.dark.color ? `--shiki-dark:${token.variants.dark.color}` : undefined,
	]
		.filter(Boolean)
		.join(";");

const render_inline_token = (token: ThemedTokenWithVariants) => {
	const style = render_inline_token_style(token);

	return {
		content: token.content,
		style: style || undefined,
	};
};

const render_inline_code = (lines: ThemedTokenWithVariants[][]) =>
	render_component_tag("InlineHighlightedCode", {
		lines: component_prop_expression(
			JSON.stringify(lines.map((line) => line.map(render_inline_token))),
		),
	});

const RenderInlineCodeHtml = (highlighter: Highlighter, code: string, language: string) =>
	Effect.try({
		try: () =>
			render_inline_code(
				highlighter.codeToTokensWithThemes(code, {
					lang: language as BundledLanguage,
					themes,
				}),
			),
		catch: (error) =>
			new CodeHighlightingError({
				language,
				message:
					error instanceof Error ? error.message : "Failed to highlight inline code.",
			}),
	});

/** Highlights a code block with the shared dual-theme Shiki renderer. */
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

/** Highlights inline code with the shared dual-theme Shiki renderer. */
export const HighlightInlineCode = ({ code, language }: { code: string; language: string }) =>
	Effect.gen(function* () {
		const normalized_language = normalize_inline_language(language, code);
		const highlighter = yield* GetHighlighter;

		yield* LoadLanguage(highlighter, normalized_language);

		return yield* RenderInlineCodeHtml(highlighter, code, normalized_language);
	});
