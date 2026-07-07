import { Effect, Schema } from "effect";
import { escape } from "html-escaper";
import { defineHastPlugin, defineMdastPlugin } from "satteri";
import { render } from "svelte/server";
import { render_file_icon } from "$lib/server/data/icons";
import { render_copy_button } from "$lib/server/markdown/components/copy-button";
import {
	type CodeMeta,
	get_code_icon_source,
	parse_code_meta,
	parse_inline_code_language_spec,
} from "$lib/server/markdown/components/code-meta";
import { HighlightCode, HighlightInlineCode } from "$lib/server/markdown/highlighting";
import Check from "@tabler/icons-svelte/icons/check";
import Selector from "@tabler/icons-svelte/icons/selector";

const inline_code_highlight_class = "docs-inline-code-highlight";

type CommandOption = {
	code: string;
	highlighted_code: string;
	icon?: string;
	icon_html: string;
	label: string;
	value: string;
};

const code_node_schema = Schema.Struct({
	lang: Schema.optional(Schema.NullOr(Schema.String)),
	meta: Schema.optional(Schema.NullOr(Schema.String)),
	type: Schema.Literal("code"),
	value: Schema.String,
});

type CodeNode = Schema.Schema.Type<typeof code_node_schema>;

const render_header = (meta: CodeMeta) => {
	const { name } = meta;
	const icon_html = render_file_icon(get_code_icon_source(meta));
	const name_html = name
		? `<span class="docs-code-snippet-filename-text">${escape(name)}</span>`
		: "";
	const filename_html =
		icon_html || name_html
			? `<div class="docs-code-snippet-filename">${icon_html}${name_html}</div>`
			: "<div></div>";
	const copy_button_html = render_copy_button({
		attributes: {
			"data-copy-kind": "code",
		},
		class_name: "docs-code-snippet-copy",
		label: "Copy code",
	});

	return `<div class="docs-code-snippet-header">${filename_html}${copy_button_html}</div>`;
};

const render_code_snippet = ({
	code,
	...meta
}: CodeMeta & {
	code: string;
}) =>
	`<div class="docs-code-snippet not-prose"><div class="docs-code-snippet-body">${render_header(
		meta,
	)}${code}</div></div>`;

const get_attribute = (
	attributes: Record<string, string | null | undefined> | null | undefined,
	name: string,
) => {
	const value = attributes?.[name];

	return typeof value === "string" && value ? value : undefined;
};

const is_code_node = Schema.is(code_node_schema);

const render_command_option = (option: CommandOption, selected: boolean) =>
	`<div class="docs-command-snippet-option" data-command-option="${escape(
		option.value,
	)}"${selected ? "" : " hidden"}>${option.highlighted_code}</div>`;

const render_selector_icon = () =>
	render(Selector, {
		props: {
			"aria-hidden": true,
			class: "docs-command-snippet-selector-icon",
			size: 16,
		},
	}).body;

const render_check = () =>
	render(Check, {
		props: {
			"aria-hidden": true,
			class: "docs-command-snippet-select-check",
			size: 16,
		},
	}).body;

const render_selected_option = (option: CommandOption, selected: boolean) =>
	`<span class="docs-command-snippet-selected-option"${
		selected ? "" : " hidden"
	} data-command-selected-option="${escape(
		option.value,
	)}">${option.icon_html}<span>${escape(option.label)}</span></span>`;

const render_command_select_item = (option: CommandOption, selected: boolean) =>
	`<button class="docs-command-snippet-item" type="button" role="option" aria-selected="${
		selected ? "true" : "false"
	}" data-command-item="${escape(option.value)}">${option.icon_html}<span>${escape(
		option.label,
	)}</span><span class="docs-command-snippet-select-check-wrap"${
		selected ? "" : " hidden"
	}>${render_check()}</span></button>`;

const render_command_select = ({
	id,
	options,
	select_label,
	selected_value,
}: {
	id: string;
	options: CommandOption[];
	select_label: string;
	selected_value: string;
}) => {
	const escaped_id = escape(id);
	const content_id = `${escaped_id}-select`;

	return `<div class="docs-command-snippet-select" data-command-select><button class="docs-command-snippet-trigger" type="button" data-slot="select-trigger" aria-haspopup="listbox" aria-expanded="false" aria-controls="${content_id}" aria-label="${escape(
		select_label,
	)}" data-command-trigger>${options
		.map((option) => render_selected_option(option, option.value === selected_value))
		.join(
			"",
		)}${render_selector_icon()}</button><div class="docs-command-snippet-content" id="${content_id}" data-slot="select-content" role="listbox" data-command-content hidden><div class="docs-command-snippet-viewport" data-slot="select-viewport">${options
		.map((option) => render_command_select_item(option, option.value === selected_value))
		.join("")}</div></div></div>`;
};

const render_command_snippet = ({
	default_value,
	id,
	options,
	select_label,
}: {
	default_value: string;
	id: string;
	options: CommandOption[];
	select_label: string;
}) => {
	const selected_option = options.find((option) => option.value === default_value) ?? options[0];
	const selected_value = selected_option?.value ?? "";
	const copy_button_html = render_copy_button({
		attributes: {
			"data-copy-kind": "command",
		},
		class_name: "docs-command-snippet-copy",
		label: "Copy command",
	});

	return `<div class="docs-command-snippet not-prose" data-command-snippet id="${escape(
		id,
	)}" data-command-value="${escape(
		selected_value,
	)}"><div class="docs-command-snippet-body"><div class="docs-command-snippet-code">${options
		.map((option) => render_command_option(option, option.value === selected_value))
		.join("")}</div>${copy_button_html}${render_command_select({
		id,
		options,
		select_label,
		selected_value,
	})}</div></div>`;
};

const get_command_option = (
	node: CodeNode,
	index: number,
): Omit<CommandOption, "highlighted_code"> => {
	const meta = parse_code_meta(node.meta);
	const value = meta.value ?? meta.name ?? `option-${index + 1}`;
	const label = meta.label ?? meta.name ?? value;

	return {
		code: node.value,
		icon: meta.icon,
		icon_html: render_file_icon(meta.icon ?? value),
		label,
		value,
	};
};

/**
 * Satteri plugin that replaces fenced code blocks with SER code snippet cards.
 * @since 0.0.1
 */
export const code_snippets = defineMdastPlugin({
	name: "code-snippets",
	containerDirective(node, ctx) {
		if (node.name !== "command-snippet") {
			return;
		}

		return Effect.runPromise(
			Effect.gen(function* () {
				const code_nodes = node.children.filter(is_code_node);
				const options = yield* Effect.all(
					code_nodes.map((code_node, index) => {
						const option = get_command_option(code_node, index);

						return HighlightCode({
							code: option.code,
							language: code_node.lang ?? "sh",
						}).pipe(
							Effect.map((highlighted_code) => ({
								...option,
								highlighted_code,
							})),
						);
					}),
				);

				if (options.length === 0) {
					return;
				}

				ctx.replaceNode(node, {
					rawHtml: render_command_snippet({
						default_value:
							get_attribute(node.attributes, "default") ?? options[0].value,
						id:
							get_attribute(node.attributes, "id") ??
							`command-snippet-${ctx.indexOf(node) ?? 0}`,
						options,
						select_label:
							get_attribute(node.attributes, "select") ?? "Select command variant",
					}),
				});
			}),
		);
	},
	code(node, ctx) {
		const parent = ctx.parent(node);

		if (
			parent?.type === "containerDirective" &&
			"name" in parent &&
			parent.name === "command-snippet"
		) {
			return;
		}

		return Effect.runPromise(
			Effect.gen(function* () {
				const meta = parse_code_meta(node.meta);
				const code = yield* HighlightCode({
					code: node.value,
					diff: meta.diff,
					language: node.lang,
				});

				ctx.replaceNode(node, {
					rawHtml: render_code_snippet({ code, ...meta }),
				});
			}),
		);
	},
});

/**
 * Satteri plugin that highlights language-prefixed inline code after markdown
 * has been converted to HAST, preserving surrounding paragraph structure.
 * @since 0.0.1
 */
export const inline_code_highlighting = defineHastPlugin({
	name: "inline-code-highlighting",
	element: {
		filter: ["code"],
		visit(node, ctx) {
			const parent = ctx.parent(node);

			if (parent?.type === "element" && parent.tagName === "pre") {
				return;
			}

			const spec = parse_inline_code_language_spec(ctx.textContent(node));

			if (!spec) {
				return;
			}

			return Effect.runPromise(
				HighlightInlineCode(spec).pipe(
					Effect.map((highlighted_code) => {
						const class_name = node.properties.className;
						const class_names = Array.isArray(class_name)
							? class_name.filter(
									(value): value is string => typeof value === "string",
								)
							: typeof class_name === "string"
								? class_name.split(/\s+/).filter(Boolean)
								: [];

						return {
							...node,
							properties: {
								...node.properties,
								className: [...class_names, inline_code_highlight_class],
								"data-language": spec.language,
							},
							children: [
								{
									type: "raw" as const,
									value: highlighted_code,
								},
							],
						};
					}),
					Effect.catchIf(
						() => true,
						() => Effect.succeed(node),
					),
				),
			);
		},
	},
});
