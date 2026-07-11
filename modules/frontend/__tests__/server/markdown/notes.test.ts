import { Option } from "effect";
import { expect, test } from "vitest";
import {
	parse_note_markdown,
	strip_blockquote_markers,
} from "$lib/server/markdown/components/note-meta.ts";

const get_note = (markdown: string) => Option.getOrThrow(parse_note_markdown(markdown));

test("parses info notes from GitHub-style blockquotes", () => {
	const markdown = strip_blockquote_markers(
		[
			"> [!INFO] `svelte-effect-runtime` needs to come first",
			"> `svelte-effect-runtime` transforms text.",
		].join("\n"),
	);
	const note = get_note(markdown);

	expect(note.variant).toBe("info");
	expect(note.icon).toBe("default");
	expect(note.title).toBe("`svelte-effect-runtime` needs to come first");
	expect(note.body).toBe("`svelte-effect-runtime` transforms text.");
});

test("supports notes without a header icon", () => {
	const note = get_note("[!WARNING] ![NONE] ✋ Are you AI?\nBody");

	expect(note.variant).toBe("warning");
	expect(note.icon).toBe("none");
	expect(note.title).toBe("✋ Are you AI?");
	expect(note.body).toBe("Body");
});

test("supports note, tip, important, warning, and caution aliases", () => {
	expect(get_note("[!NOTE]\nBody").variant).toBe("info");
	expect(get_note("[!TIP]\nBody").variant).toBe("tip");
	expect(get_note("[!IMPORTANT]\nBody").variant).toBe("tip");
	expect(get_note("[!WARNING]\nBody").variant).toBe("warning");
	expect(get_note("[!CAUTION]\nBody").variant).toBe("warning");
});
