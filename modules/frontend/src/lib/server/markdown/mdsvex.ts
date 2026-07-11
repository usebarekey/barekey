import { Effect, Option } from "effect";
import { unescape as unescape_html } from "html-escaper";
import { escapeSvelte, type MdsvexOptions } from "mdsvex";
import type { Component } from "svelte";
import { create_heading_id } from "./headings";
import { RenderCodeSnippet } from "./components/code-snippets";
import { RenderCopyButton } from "./components/copy-button";
import { RenderInlineCodeIcon } from "./components/inline-code-icons";
import { parse_note_markdown, type ParsedNote } from "./components/note-meta";
import { RenderNoteHeader } from "./components/notes";
import { HighlightCode, HighlightInlineCode } from "./highlighting";
import {
	ParseCodeMeta,
	parse_inline_code_icon_spec,
	parse_inline_code_language_spec,
} from "./components/code-meta";
import remarkGfm from "remark-gfm";

export const mdsvex_extensions = [".mdx"];

/** Compiled docs mdsvex module shape. */
export type DocsMdxModule = {
	default: Component;
	metadata: Record<string, unknown>;
};

type UnistNode = {
	children?: UnistNode[];
	properties?: Record<string, unknown>;
	tagName?: string;
	type: string;
	value?: string;
};

type VisitorResult = false | void;
type NodeVisitor = (
	node: UnistNode,
	parent: UnistNode | undefined,
	index: number | undefined,
) => VisitorResult;

const inline_code_highlight_class = "docs-inline-code-highlight";
const inline_code_icon_class = "docs-inline-code-icon";
const new_tab_link_rel_tokens = ["noopener", "noreferrer", "external"];

const strip_shiki_tabindex = (html: string) => html.replaceAll(' tabindex="0"', "");

const has_children = (node: UnistNode): node is UnistNode & { children: UnistNode[] } =>
	Array.isArray(node.children);

const visit_nodes = (node: UnistNode, visitor: NodeVisitor, parent?: UnistNode, index?: number) => {
	if (visitor(node, parent, index) === false) {
		return;
	}

	if (!has_children(node)) {
		return;
	}

	for (const [child_index, child] of node.children.entries()) {
		visit_nodes(child, visitor, node, child_index);
	}
};

const text_content = (node: UnistNode): string => {
	if (typeof node.value === "string") {
		return node.value;
	}

	return has_children(node) ? node.children.map(text_content).join("") : "";
};

const decode_inline_svelte_braces = (value: string) =>
	value.replaceAll("&#123;", "{").replaceAll("&#125;", "}");

const inline_code_text_content = (node: UnistNode) =>
	decode_inline_svelte_braces(unescape_html(text_content(node)));

const is_element = (node: UnistNode, tag_name?: string) =>
	node.type === "element" && (!tag_name || node.tagName === tag_name);

const get_class_names = (properties: Record<string, unknown> | undefined) => {
	const class_name = properties?.className;

	if (Array.isArray(class_name)) {
		return class_name.filter((value): value is string => typeof value === "string");
	}

	return typeof class_name === "string" ? class_name.split(/\s+/).filter(Boolean) : [];
};

const get_hast_id = (properties: Record<string, unknown> | undefined) => {
	const id = properties?.id;

	return typeof id === "string" && id ? id : undefined;
};

const append_class_name = (
	properties: Record<string, unknown> | undefined,
	class_name: string,
) => ({
	...properties,
	className: [...get_class_names(properties), class_name],
});

const get_hast_href = (properties: Record<string, unknown> | undefined) => {
	const href = properties?.href;

	return typeof href === "string" && href ? href : undefined;
};

const docs_href_pattern = /^\/docs(?:[/?#]|$)/;
const href_protocol_pattern = /^[a-z][a-z\d+.-]*:/i;

const is_absolute_href = (href: string) =>
	href_protocol_pattern.test(href) || href.startsWith("//");

export const is_docs_markdown_href = (href: string) => {
	if (href.startsWith("#") || href.startsWith("?")) {
		return true;
	}

	if (docs_href_pattern.test(href)) {
		return true;
	}

	if (href.startsWith("/") || is_absolute_href(href)) {
		return false;
	}

	return true;
};

const get_attribute_tokens = (value: unknown) => {
	if (Array.isArray(value)) {
		return value.filter(
			(token): token is string => typeof token === "string" && Boolean(token),
		);
	}

	return typeof value === "string" ? value.split(/\s+/).filter(Boolean) : [];
};

const merge_attribute_tokens = (value: unknown, tokens: string[]) =>
	Array.from(new Set([...get_attribute_tokens(value), ...tokens]));

export const get_markdown_link_properties = (properties: Record<string, unknown>) => {
	const href = get_hast_href(properties);

	if (!href || is_docs_markdown_href(href)) {
		return properties;
	}

	return {
		...properties,
		rel: merge_attribute_tokens(properties.rel, new_tab_link_rel_tokens),
		target: "_blank",
	};
};

const command_picker_item_pattern = /<CommandPicker\.Item\b([^>]*?)\/>/gs;
const command_picker_root_pattern =
	/<CommandPicker\.Root\b([^>]*)>([\s\S]*?)<\/CommandPicker\.Root>/g;
const command_picker_string_attribute_pattern = (name: string) =>
	new RegExp(`\\b${name}=(?:"([^"]*)"|'([^']*)')`);

const read_command_picker_attribute = (attributes: string, name: string) => {
	const match = command_picker_string_attribute_pattern(name).exec(attributes);

	return match?.[1] ?? match?.[2];
};

type CommandPickerOption = {
	command: string;
	icon?: string;
	label: string;
	value: string;
};

const create_command_picker_option = (attributes: string) => {
	const command = read_command_picker_attribute(attributes, "command");
	const value = read_command_picker_attribute(attributes, "value");

	if (!command || !value) {
		return Option.none<CommandPickerOption>();
	}

	return Option.some({
		command,
		icon: read_command_picker_attribute(attributes, "icon"),
		label: read_command_picker_attribute(attributes, "label") ?? value,
		value,
	});
};

const TransformCommandPickerItem = (source: string, attributes: string) =>
	Effect.gen(function* () {
		const option = create_command_picker_option(attributes);

		if (Option.isNone(option)) {
			return {
				option,
				replacement: source,
				source,
			};
		}

		const language = read_command_picker_attribute(attributes, "language") ?? "sh";
		const highlighted_code = escapeSvelte(
			strip_shiki_tabindex(
				yield* HighlightCode({
					code: option.value.command,
					language,
				}),
			),
		);

		return {
			option,
			replacement: `<CommandPicker.Item${attributes}>\n${highlighted_code}\n</CommandPicker.Item>`,
			source,
		};
	});

const InjectCommandPickerItems = (content: string) =>
	Effect.gen(function* () {
		const replacements = yield* Effect.all(
			Array.from(content.matchAll(command_picker_item_pattern)).map((match) =>
				TransformCommandPickerItem(match[0], match[1] ?? ""),
			),
		);

		return replacements.reduce(
			(output, { replacement, source }) => output.replace(source, replacement),
			content,
		);
	});

const inject_command_picker_options = (
	attributes: string,
	options: ReturnType<typeof create_command_picker_option>[],
) => {
	if (/\boptions=/.test(attributes)) {
		return attributes;
	}

	const command_options = options.flatMap((option) =>
		Option.isSome(option) ? [option.value] : [],
	);

	return `${attributes} options={${JSON.stringify(command_options)}}`;
};

const TransformCommandPickerRoot = (source: string, attributes: string, content: string) =>
	Effect.gen(function* () {
		const item_transforms = yield* Effect.all(
			Array.from(content.matchAll(command_picker_item_pattern)).map((match) =>
				TransformCommandPickerItem(match[0], match[1] ?? ""),
			),
		);
		const transformed_content = item_transforms.reduce(
			(output, { replacement, source }) => output.replace(source, replacement),
			content,
		);
		const transformed_attributes = inject_command_picker_options(
			attributes,
			item_transforms.map(({ option }) => option),
		);

		return {
			replacement: `<CommandPicker.Root${transformed_attributes}>${transformed_content}</CommandPicker.Root>`,
			source,
		};
	});

const InjectCommandPickerHighlighting = (content: string) =>
	Effect.gen(function* () {
		const root_matches = Array.from(content.matchAll(command_picker_root_pattern));

		if (!root_matches.length) {
			return yield* InjectCommandPickerItems(content);
		}

		const replacements = yield* Effect.all(
			root_matches.map((match) =>
				TransformCommandPickerRoot(match[0], match[1] ?? "", match[2] ?? ""),
			),
		);

		return replacements.reduce(
			(output, { replacement, source }) => output.replace(source, replacement),
			content,
		);
	});

const markdown_component_imports = [
	'import CodeSnippet from "$lib/components/markdown/code-snippet.sv";',
	'import CopyButton from "$lib/components/markdown/copy-button.sv";',
	'import FileIcon from "$lib/components/markdown/file-icon.sv";',
	'import InlineCodeIcon from "$lib/components/markdown/inline-code-icon.sv";',
	'import InlineHighlightedCode from "$lib/components/markdown/inline-highlighted-code.sv";',
	'import NoteHeader from "$lib/components/markdown/note-header.sv";',
].join("\n");

const frontmatter_pattern = /^---\s*[\r\n][\s\S]*?[\r\n]---\s*[\r\n]?/;
const opening_script_pattern = /^\s*<script\b[^>]*>/;

const inject_markdown_component_imports = (content: string) => {
	if (content.includes('"$lib/components/markdown/code-snippet.sv"')) {
		return content;
	}

	const frontmatter = frontmatter_pattern.exec(content)?.[0] ?? "";
	const body = content.slice(frontmatter.length);
	const opening_script = opening_script_pattern.exec(body);

	if (!opening_script) {
		return `${frontmatter}<script lang="ts">\n${markdown_component_imports}\n</script>\n\n${body}`;
	}

	const insertion_index = frontmatter.length + opening_script[0].length;

	return `${content.slice(0, insertion_index)}\n${markdown_component_imports}${content.slice(
		insertion_index,
	)}`;
};

export const command_picker_preprocessor = () => ({
	markup: async ({ content, filename }: { content: string; filename?: string }) => {
		if (!filename?.endsWith(".mdx")) {
			return;
		}

		const content_with_imports = inject_markdown_component_imports(content);

		if (!content_with_imports.includes("<CommandPicker.Item")) {
			return {
				code: content_with_imports,
			};
		}

		return {
			code: await Effect.runPromise(InjectCommandPickerHighlighting(content_with_imports)),
		};
	},
	name: "docs-command-picker",
});

const MarkdownCodeHighlighter = (
	code: string,
	language: string | null | undefined,
	meta: string | null | undefined,
) =>
	Effect.gen(function* () {
		const parsed_meta = yield* ParseCodeMeta(meta);
		const highlighted_code = strip_shiki_tabindex(
			yield* HighlightCode({
				code,
				diff: parsed_meta.diff,
				language,
			}),
		);

		return yield* RenderCodeSnippet({
			code: highlighted_code,
			...parsed_meta,
		});
	});

const markdown_code_highlighter = async (
	code: string,
	language: string | null | undefined,
	meta: string | null | undefined,
) => Effect.runPromise(MarkdownCodeHighlighter(code, language, meta));

const heading_ids_plugin = () => (tree: UnistNode) => {
	const used_heading_ids = new Map<string, number>();

	visit_nodes(tree, (node) => {
		if (!is_element(node) || !["h2", "h3", "h4", "h5", "h6"].includes(node.tagName ?? "")) {
			return;
		}

		const title = text_content(node).trim();

		if (!title) {
			return;
		}

		const id = get_hast_id(node.properties) ?? create_heading_id(title, used_heading_ids);

		node.properties = {
			...node.properties,
			id,
		};
	});
};

const ApplyHeadingCopyLinks = (tree: UnistNode) =>
	Effect.gen(function* () {
		const headings: { id: string; node: UnistNode }[] = [];

		visit_nodes(tree, (node) => {
			if (!is_element(node) || !["h2", "h3", "h4", "h5", "h6"].includes(node.tagName ?? "")) {
				return;
			}

			const id = get_hast_id(node.properties);

			if (!id) {
				return;
			}

			headings.push({ id, node });
		});

		for (const { id, node } of headings) {
			const heading_children = node.children ?? [];
			node.children = [
				{
					type: "element",
					tagName: "a",
					properties: {
						"aria-label": `Jump to ${text_content(node).trim()}`,
						className: ["docs-heading-self-link"],
						href: `#${id}`,
					},
					children: heading_children,
				},
			];
			node.properties = append_class_name(node.properties, "docs-heading");
			node.children.push({
				type: "raw",
				value: yield* RenderCopyButton({
					class_name: "docs-heading-copy not-prose",
					copy_kind: "heading-link",
					feedback_text: "Copied link.",
					heading_id: id,
					label: "Copy link",
				}),
			});
		}
	});

const heading_copy_links_plugin = () => async (tree: UnistNode) =>
	Effect.runPromise(ApplyHeadingCopyLinks(tree));

type InlineCodeIconJob = {
	node: UnistNode;
	spec: {
		icon: string;
		text: string;
	};
};

type InlineCodeHighlightJob = {
	node: UnistNode;
	spec: {
		code: string;
		language: string;
	};
};

const ApplyInlineCodeHighlighting = (tree: UnistNode) =>
	Effect.gen(function* () {
		const icon_jobs: InlineCodeIconJob[] = [];
		const highlight_jobs: InlineCodeHighlightJob[] = [];

		visit_nodes(tree, (node, parent) => {
			if (!is_element(node, "code") || is_element(parent ?? { type: "" }, "pre")) {
				return;
			}

			const code_text = inline_code_text_content(node);
			const icon_spec = parse_inline_code_icon_spec(code_text);

			if (Option.isSome(icon_spec)) {
				icon_jobs.push({
					node,
					spec: icon_spec.value,
				});
				return;
			}

			const spec = parse_inline_code_language_spec(code_text);

			if (Option.isNone(spec)) {
				return;
			}

			highlight_jobs.push({
				node,
				spec: spec.value,
			});
		});

		for (const { node, spec } of icon_jobs) {
			node.properties = {
				...node.properties,
				className: [...get_class_names(node.properties), inline_code_icon_class],
			};
			node.children = [
				{
					type: "raw",
					value: yield* RenderInlineCodeIcon(spec),
				},
			];
		}

		const highlighted_code_blocks = yield* Effect.all(
			highlight_jobs.map(({ spec }) => HighlightInlineCode(spec)),
		);

		for (const [index, highlighted_code] of highlighted_code_blocks.entries()) {
			const { node, spec } = highlight_jobs[index]!;

			node.properties = {
				...node.properties,
				className: [...get_class_names(node.properties), inline_code_highlight_class],
				"data-language": spec.language,
			};
			node.children = [
				{
					type: "raw",
					value: highlighted_code,
				},
			];
		}
	});

const inline_code_highlighting_plugin = () => async (tree: UnistNode) =>
	Effect.runPromise(ApplyInlineCodeHighlighting(tree));

const markdown_link_targets_plugin = () => (tree: UnistNode) => {
	visit_nodes(tree, (node) => {
		if (!is_element(node, "a")) {
			return;
		}

		const href = get_hast_href(node.properties);

		if (!href || is_docs_markdown_href(href)) {
			return;
		}

		node.properties = get_markdown_link_properties(node.properties);
	});
};

const get_first_paragraph = (node: UnistNode) => {
	if (!has_children(node)) {
		return;
	}

	const index = node.children.findIndex((child) => is_element(child, "p"));

	if (index < 0) {
		return;
	}

	return {
		index,
		node: node.children[index]!,
	};
};

const first_line_break_pattern = /\r\n?|\n/;

const strip_note_marker_line = (paragraph: UnistNode) => {
	if (!has_children(paragraph)) {
		return false;
	}

	let stripping_marker_line = true;
	const body_children: UnistNode[] = [];

	for (const child of paragraph.children) {
		if (!stripping_marker_line) {
			body_children.push(child);
			continue;
		}

		if (typeof child.value !== "string") {
			continue;
		}

		const line_break = first_line_break_pattern.exec(child.value);

		if (!line_break) {
			continue;
		}

		const body_text = child.value.slice(line_break.index + line_break[0].length);

		if (body_text) {
			body_children.push({
				...child,
				value: body_text,
			});
		}

		stripping_marker_line = false;
	}

	paragraph.children = body_children;

	return body_children.some((child) => text_content(child).trim());
};

type GithubAlertJob = {
	first_paragraph: {
		index: number;
		node: UnistNode;
	};
	node: UnistNode;
	note: ParsedNote;
};

const ApplyGithubAlerts = (tree: UnistNode) =>
	Effect.gen(function* () {
		const alert_jobs: GithubAlertJob[] = [];

		visit_nodes(tree, (node) => {
			if (!is_element(node, "blockquote") || !has_children(node)) {
				return;
			}

			const first_paragraph = get_first_paragraph(node);

			if (!first_paragraph) {
				return;
			}

			const note = parse_note_markdown(text_content(first_paragraph.node));

			if (Option.isNone(note)) {
				return;
			}

			alert_jobs.push({
				first_paragraph,
				node,
				note: note.value,
			});

			return false;
		});

		for (const { first_paragraph, node, note } of alert_jobs) {
			if (!strip_note_marker_line(first_paragraph.node)) {
				node.children?.splice(first_paragraph.index, 1);
			}

			const body_children = node.children ?? [];
			node.tagName = "aside";
			node.properties = {
				className: ["docs-note", "not-prose"],
				"data-note-variant": note.variant,
			};
			node.children = [
				{
					type: "raw",
					value: yield* RenderNoteHeader({
						icon: note.icon,
						title: note.title,
						variant: note.variant,
					}),
				},
				...(body_children.length
					? [
							{
								type: "element",
								tagName: "div",
								properties: {
									className: ["docs-note-body"],
								},
								children: body_children,
							},
						]
					: []),
			];
		}
	});

const github_alerts_plugin = () => async (tree: UnistNode) =>
	Effect.runPromise(ApplyGithubAlerts(tree));

export const markdown_mdsvex_options: MdsvexOptions = {
	extensions: mdsvex_extensions,
	highlight: {
		highlighter: markdown_code_highlighter,
	},
	rehypePlugins: [
		heading_ids_plugin,
		github_alerts_plugin,
		heading_copy_links_plugin,
		inline_code_highlighting_plugin,
		markdown_link_targets_plugin,
	],
	remarkPlugins: [remarkGfm],
	smartypants: false,
};
