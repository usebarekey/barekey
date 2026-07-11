import { Option } from "effect";

/**
 * Visual variants supported by docs notes.
 */
export type NoteVariant = "info" | "tip" | "warning";

/**
 * Parsed docs note metadata and body Markdown.
 */
export type ParsedNote = {
	body: string;
	icon: "default" | "none";
	title: string;
	variant: NoteVariant;
};

const note_marker_pattern = /^\[!(INFO|NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:\s+(.*))?$/i;
const no_icon_pattern = /^!\[NONE\](?:\s+|$)/i;

const note_variant_aliases: Record<string, NoteVariant> = {
	caution: "warning",
	important: "tip",
	info: "info",
	note: "info",
	tip: "tip",
	warning: "warning",
};

const default_note_titles: Record<string, string> = {
	caution: "Caution",
	important: "Important",
	info: "Info",
	note: "Note",
	tip: "Tip",
	warning: "Warning",
};

export const strip_blockquote_markers = (source: string) =>
	source
		.replace(/\r\n?/g, "\n")
		.split("\n")
		.map((line) => line.replace(/^[\t ]*> ?/, ""))
		.join("\n")
		.trim();

export const parse_note_markdown = (markdown: string): Option.Option<ParsedNote> => {
	const [raw_marker = "", ...body_lines] = markdown.replace(/\r\n?/g, "\n").split("\n");
	const match = raw_marker.trim().match(note_marker_pattern);

	if (!match) {
		return Option.none();
	}

	const marker = match[1].toLowerCase();
	const custom_title = match[2]?.trim();
	const hides_icon = custom_title ? no_icon_pattern.test(custom_title) : false;
	const title = hides_icon ? custom_title?.replace(no_icon_pattern, "").trim() : custom_title;

	return Option.some({
		body: body_lines.join("\n").trim(),
		icon: hides_icon ? "none" : "default",
		title: title || default_note_titles[marker],
		variant: note_variant_aliases[marker],
	});
};
