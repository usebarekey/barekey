import { expect, test } from "vitest";
import {
	parse_note_markdown,
	strip_blockquote_markers,
} from "../../../src/lib/server/markdown/components/note-meta.ts";

test("parses info notes from GitHub-style blockquotes", () => {
	const markdown = strip_blockquote_markers(
		[
			"> [!INFO] `svelte-effect-runtime` needs to come first",
			"> `svelte-effect-runtime` transforms text.",
		].join("\n"),
	);
	const note = parse_note_markdown(markdown);

	expect(note?.variant).toBe("info");
	expect(note?.title).toBe("`svelte-effect-runtime` needs to come first");
	expect(note?.body).toBe("`svelte-effect-runtime` transforms text.");
});

test("supports note, tip, important, warning, and caution aliases", () => {
	expect(parse_note_markdown("[!NOTE]\nBody")?.variant).toBe("info");
	expect(parse_note_markdown("[!TIP]\nBody")?.variant).toBe("tip");
	expect(parse_note_markdown("[!IMPORTANT]\nBody")?.variant).toBe("tip");
	expect(parse_note_markdown("[!WARNING]\nBody")?.variant).toBe("warning");
	expect(parse_note_markdown("[!CAUTION]\nBody")?.variant).toBe("warning");
});
