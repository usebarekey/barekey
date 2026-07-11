import type { InlineCodeIconSpec } from "./code-meta";
import { RenderComponentTag } from "./component-tags";

export const RenderInlineCodeIcon = ({ char, icon, line, link, name }: InlineCodeIconSpec) =>
	RenderComponentTag("InlineCodeIcon", {
		char,
		icon,
		line,
		link,
		name,
	});
