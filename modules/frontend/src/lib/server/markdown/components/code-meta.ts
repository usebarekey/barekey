import { Effect, Option } from "effect";

/**
 * Parsed metadata from a fenced code block info string.
 */
export type CodeMeta = {
	char?: number;
	diff: boolean;
	icon?: string;
	label?: string;
	line?: number;
	link?: string;
	name?: string;
	value?: string;
};

/**
 * Parsed language-prefixed inline code.
 */
export type InlineCodeLanguageSpec = {
	code: string;
	language: string;
};

/**
 * Parsed metadata-prefixed inline code with an icon.
 */
export type InlineCodeIconSpec = {
	char?: number;
	icon?: string;
	line?: number;
	link?: string;
	name: string;
	text: string;
};

const inline_code_language_pattern = /^([A-Za-z][\w+-]*)[ \t\r\n]+(.+)$/s;
const inline_code_attribute_prefix_pattern =
	/^((?:[A-Za-z_][\w:-]*(?:=(?:"[^"]*"|'[^']*'|[^\s"']+))?[ \t\r\n]+)+)(\S[\s\S]*)$/;
const inline_code_attributes_only_pattern =
	/^(?:[A-Za-z_][\w:-]*=(?:"[^"]*"|'[^']*'|[^\s"']+)(?:[ \t\r\n]+|$))+$/;
const inline_code_attribute_pattern = /([A-Za-z_][\w:-]*)(?:=(?:"([^"]*)"|'([^']*)'|([^\s"']+)))?/g;
const code_meta_attribute_pattern = /([^\s=]+)(?:=(?:"([^"]*)"|'([^']*)'|([^\s"']+)))?/g;
const inline_code_languages = new Set([
	"bash",
	"css",
	"html",
	"js",
	"json",
	"jsx",
	"markdown",
	"md",
	"ser",
	"sh",
	"shell",
	"svelte",
	"ts",
	"tsx",
	"typescript",
	"yaml",
	"yml",
]);

const read_attribute_value = (match: RegExpMatchArray) => match[2] ?? match[3] ?? match[4] ?? "";

const parse_source_coordinate = (value: string | undefined) => {
	if (!value || !/^\d+$/.test(value)) {
		return;
	}

	return Number(value);
};

const parse_code_meta = (meta: string | null | undefined): CodeMeta => {
	const attributes: Record<string, string> = {};

	for (const match of meta?.matchAll(code_meta_attribute_pattern) ?? []) {
		attributes[match[1]] = read_attribute_value(match);
	}

	return {
		char: parse_source_coordinate(attributes.char),
		diff: "diff" in attributes,
		icon: attributes.icon || undefined,
		label: attributes.label || undefined,
		line: parse_source_coordinate(attributes.line),
		link: attributes.link || undefined,
		name: attributes.name ?? attributes.filename,
		value: attributes.value || undefined,
	};
};

export const ParseCodeMeta = (meta: string | null | undefined) =>
	Effect.sync(() => parse_code_meta(meta));

export const get_code_icon_source = ({ icon, name }: CodeMeta) => icon || name;

export const parse_inline_code_language_spec = (
	value: string,
): Option.Option<InlineCodeLanguageSpec> => {
	const match = inline_code_language_pattern.exec(value);

	if (!match) {
		return Option.none();
	}

	const language = match[1].toLowerCase();

	if (!inline_code_languages.has(language)) {
		return Option.none();
	}

	return Option.some({
		code: match[2],
		language,
	});
};

export const parse_inline_code_icon_spec = (value: string): Option.Option<InlineCodeIconSpec> => {
	const attributes_only = inline_code_attributes_only_pattern.test(value);
	const prefixed_match = attributes_only ? null : inline_code_attribute_prefix_pattern.exec(value);

	if (!prefixed_match && !attributes_only) {
		return Option.none();
	}

	const attributes: Record<string, string> = {};
	const attribute_source = prefixed_match?.[1] ?? value;

	for (const attribute_match of attribute_source.matchAll(inline_code_attribute_pattern)) {
		attributes[attribute_match[1]] = read_attribute_value(attribute_match);
	}

	const icon = attributes.icon?.trim();
	const text = prefixed_match?.[2].trim() ?? attributes.name?.trim();

	if (!text || (!icon && !attributes.name)) {
		return Option.none();
	}

	const char = parse_source_coordinate(attributes.char);
	const line = parse_source_coordinate(attributes.line);
	const link = attributes.link || undefined;

	return Option.some({
		...(char !== undefined ? { char } : {}),
		...(icon ? { icon } : {}),
		...(line !== undefined ? { line } : {}),
		...(link ? { link } : {}),
		name: attributes.name?.trim() || text,
		text,
	});
};
