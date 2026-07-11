import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import { get_middle_ellipsis_text } from "$lib/client/command-middle-ellipsis.ts";

const measure_characters = (value: string) => value.length;

test("renders compact commands from a clone of the highlighted source", () => {
	const source = readFileSync("src/lib/client/command-middle-ellipsis.ts", "utf8");

	expect(source).toContain("source.cloneNode(true)");
	expect(source).toContain("highlighted.childNodes");
});

test("uses the copy-button surface treatment for the package-manager trigger", () => {
	const styles = readFileSync("src/lib/styles/markdown/components/command-snippet.css", "utf8");

	expect(styles).toContain("rounded-full bg-linear-to-b from-foreground/7.5");
	expect(styles).toContain("to-foreground/2.5");
	expect(styles).toContain("@apply h-auto min-w-0 p-2");
});

test("returns the full command when it fits", () => {
	expect(get_middle_ellipsis_text("deno add effect", 15, measure_characters)).toBe(
		"deno add effect",
	);
});

test("preserves the command prefix and final argument when truncating", () => {
	expect(
		get_middle_ellipsis_text(
			"deno add --allow-scripts npm:svelte-effect-runtime@latest",
			44,
			measure_characters,
		),
	).toBe("deno add … npm:svelte-effect-runtime@latest");
});

test("uses all available width without changing command order", () => {
	const command = "pnpm add --save-dev better-svelte-check";
	const result = get_middle_ellipsis_text(command, 32, measure_characters);
	const [prefix, suffix] = result.split(" … ");

	expect(result.length).toBeLessThanOrEqual(32);
	expect(command.startsWith(prefix ?? "")).toBe(true);
	expect(command.endsWith(suffix ?? "")).toBe(true);
});

test("prioritizes the complete command prefix and final argument tail", () => {
	expect(
		get_middle_ellipsis_text("deno add npm:svelte-effect-runtime", 19, measure_characters),
	).toBe("deno add … runtime");
});

test("cuts package suffixes at semantic separators", () => {
	expect(
		get_middle_ellipsis_text(
			"deno add npm:svelte-plugin-composer",
			152,
			(value) => value.length * 8,
		),
	).toBe("deno add … composer");
});

test("does not leave arbitrary command fragments before the ellipsis", () => {
	expect(
		get_middle_ellipsis_text("bun add svelte-effect-runtime", 167, (value) => value.length * 8),
	).toBe("bun add … runtime");
});

test("falls back to a bare ellipsis in extremely narrow spaces", () => {
	expect(get_middle_ellipsis_text("deno add effect", 1, measure_characters)).toBe("…");
});
