import { get_code_icon_source, type CodeMeta } from "./code-meta";
import { RenderComponentTag } from "./component-tags";

export const RenderCodeSnippet = ({
	code,
	...meta
}: CodeMeta & {
	code: string;
}) =>
	RenderComponentTag("CodeSnippet", {
		char: meta.char,
		code,
		icon_source: get_code_icon_source(meta),
		line: meta.line,
		link: meta.link,
		name: meta.name,
	});
