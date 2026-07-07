/**
 * Visual variants supported by docs notes.
 * @since 0.0.1
 */
export type NoteVariant = "info" | "tip" | "warning";

/**
 * Parsed docs note metadata and body Markdown.
 * @since 0.0.1
 */
export type ParsedNote = {
	body: string;
	title: string;
	variant: NoteVariant;
};

const note_marker_pattern = /^\[!(INFO|NOTE|TIP|IMPORTANT|WARNING|CAUTION)\](?:\s+(.*))?$/i;

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

/**
 * Removes blockquote prefixes from a raw Markdown blockquote source slice.
 * @param source Raw Markdown source for a blockquote.
 * @returns Markdown content inside the blockquote.
 * @since 0.0.1
 */
export const strip_blockquote_markers = (source: string) =>
	source
		.replace(/\r\n?/g, "\n")
		.split("\n")
		.map((line) => line.replace(/^[\t ]*> ?/, ""))
		.join("\n")
		.trim();

/**
 * Parses a GitHub-style alert marker from note Markdown.
 * @param markdown Markdown content inside a blockquote.
 * @returns Parsed note metadata when the blockquote starts with an alert marker.
 * @since 0.0.1
 */
export const parse_note_markdown = (markdown: string): ParsedNote | undefined => {
	const [raw_marker = "", ...body_lines] = markdown.replace(/\r\n?/g, "\n").split("\n");
	const match = raw_marker.trim().match(note_marker_pattern);

	if (!match) {
		return;
	}

	const marker = match[1].toLowerCase();

	return {
		body: body_lines.join("\n").trim(),
		title: match[2]?.trim() || default_note_titles[marker],
		variant: note_variant_aliases[marker],
	};
};
