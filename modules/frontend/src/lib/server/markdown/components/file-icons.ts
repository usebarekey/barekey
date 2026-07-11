import { RenderComponentTag } from "./component-tags";

export const RenderFileIconHtml = (filename: string | undefined) =>
	RenderComponentTag("FileIcon", {
		name: filename,
	});
