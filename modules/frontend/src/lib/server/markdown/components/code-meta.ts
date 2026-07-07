/**
 * Parsed metadata from a fenced code block info string.
 * @since 0.0.1
 */
export type CodeMeta = {
	diff: boolean;
	icon?: string;
	label?: string;
	name?: string;
	value?: string;
};

/**
 * Parsed language-prefixed inline code.
 * @since 0.0.1
 */
export type InlineCodeLanguageSpec = {
	code: string;
	language: string;
};

const inline_code_language_pattern = /^([A-Za-z][\w+-]*)[ \t\r\n]+(.+)$/s;

/**
 * Parses code fence metadata attributes from a Markdown info string.
 * @param meta Raw code fence metadata.
 * @returns Parsed code metadata.
 * @since 0.0.1
 */
export const parse_code_meta = (meta: string | null | undefined): CodeMeta => {
	const attributes: Record<string, string> = {};
	const pattern = /([^\s=]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s"']+)))?/g;

	for (const match of meta?.matchAll(pattern) ?? []) {
		attributes[match[1]] = match[2] ?? match[3] ?? match[4] ?? "";
	}

	return {
		diff: "diff" in attributes,
		icon: attributes.icon || undefined,
		label: attributes.label || undefined,
		name: attributes.name ?? attributes.filename,
		value: attributes.value || undefined,
	};
};

/**
 * Selects the icon source for code snippet chrome.
 * @param meta Parsed code metadata.
 * @returns Filename or icon identifier used for icon lookup.
 * @since 0.0.1
 */
export const get_code_icon_source = ({ icon, name }: CodeMeta) => icon || name;

/**
 * Parses the optional inline-code language prefix, as in `ts const value = 1`.
 * @param value Raw inline code value.
 * @returns Parsed language and code when a prefix is present.
 * @since 0.0.1
 */
export const parse_inline_code_language_spec = (value: string): InlineCodeLanguageSpec | null => {
	const match = inline_code_language_pattern.exec(value);

	if (!match) {
		return null;
	}

	return {
		code: match[2],
		language: match[1],
	};
};
