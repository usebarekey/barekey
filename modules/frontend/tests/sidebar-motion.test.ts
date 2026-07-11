import { readFileSync } from "node:fs";
import { expect, test } from "vitest";
import {
	get_sidebar_flip_translation,
	get_sidebar_stagger_delays,
} from "$lib/client/sidebar-motion.ts";

test("sidebar stagger stays inside a fixed motion window as the list grows", () => {
	const short_last = get_sidebar_stagger_delays(4, 5);
	const long_last = get_sidebar_stagger_delays(20, 21);
	const long_first = get_sidebar_stagger_delays(0, 21);

	expect(short_last.enter_ms).toBe(160);
	expect(long_last.enter_ms).toBe(250);
	expect(long_first.exit_ms).toBe(150);
});

test("short sidebars keep their original stagger cadence", () => {
	expect(get_sidebar_stagger_delays(1, 5).enter_ms).toBe(40);
	expect(get_sidebar_stagger_delays(3, 5).exit_ms).toBe(28);
});

test("a single sidebar child starts without a delay", () => {
	expect(get_sidebar_stagger_delays(0, 0)).toEqual({ enter_ms: 0, exit_ms: 0 });
	expect(get_sidebar_stagger_delays(0, 1)).toEqual({ enter_ms: 0, exit_ms: 0 });
});

test("sidebar FLIP preserves the previous visual position", () => {
	expect(get_sidebar_flip_translation({ left: 256, top: 8 }, { left: 56, top: 8 })).toEqual({
		x: 200,
		y: 0,
	});
});

test("sidebar shell collapse avoids layout-property transitions", () => {
	const css = readFileSync("src/lib/styles/sidebar.css", "utf8");
	const shell_motion = css.match(/\.t-sidebar-motion \{[\s\S]*?\n\}/)?.[0];

	expect(shell_motion).toBeDefined();
	expect(shell_motion).not.toMatch(/\b(width|height|max-width|inset-inline-(start|end))\b/);
	expect(shell_motion).toContain("clip-path");
});
