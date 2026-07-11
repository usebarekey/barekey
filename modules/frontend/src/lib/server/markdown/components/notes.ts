import { RenderComponentTag } from "./component-tags";
import type { NoteVariant, ParsedNote } from "./note-meta";

export const RenderNoteHeader = ({
	icon,
	title,
	variant,
}: {
	icon: ParsedNote["icon"];
	title: string;
	variant: NoteVariant;
}) =>
	RenderComponentTag("NoteHeader", {
		icon,
		title,
		variant,
	});
