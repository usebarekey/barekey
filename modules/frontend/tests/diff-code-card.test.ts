import { expect, test } from "vitest";
import { create_diff_card_path } from "$lib/client/diff-code-card.ts";

test("diff card caps inner-corner lips by the narrow section width", () => {
	const path = create_diff_card_path(
		[
			{ height: 24, right: 80, top: 0, width: 80 },
			{ height: 24, right: 8, top: 24, width: 8 },
			{ height: 24, right: 80, top: 48, width: 80 },
		],
		14,
		10,
	);

	expect(path).toContain("Q 80 24 68 24");
	expect(path).toContain("L 12 24");
	expect(path).toContain("Q 8 24 8 28");
	expect(path).toContain("L 8 44");
	expect(path).toContain("Q 8 48 12 48");
});

test("diff card can remove inner lips without removing stepped outer radii", () => {
	const path = create_diff_card_path(
		[
			{ height: 24, right: 80, top: 0, width: 80 },
			{ height: 24, right: 160, top: 24, width: 160 },
			{ height: 24, right: 80, top: 48, width: 80 },
		],
		14,
		0,
	);

	expect(path).not.toContain("Q 80 24 90 24");
	expect(path).not.toContain("Q 80 48 80 58");
	expect(path).toContain("L 148 24");
	expect(path).toContain("Q 160 24 160 36");
	expect(path).toContain("Q 160 48 148 48");
});

test("diff card keeps lips visible without flattening exposed step corners", () => {
	const path = create_diff_card_path(
		[
			{ height: 24, right: 80, top: 0, width: 80 },
			{ height: 24, right: 92, top: 24, width: 92 },
		],
		14,
		14,
	);

	expect(path).not.toContain("Q 92 24 92 30");
	expect(path).toContain("Q 80 24 84 24");
	expect(path).toContain("Q 92 24 92 36");
});

test("diff card keeps lips visible when the next line is shorter", () => {
	const path = create_diff_card_path(
		[
			{ height: 24, right: 92, top: 0, width: 92 },
			{ height: 24, right: 80, top: 24, width: 80 },
		],
		14,
		14,
	);

	expect(path).not.toContain("Q 80 24 80 27");
	expect(path).toContain("Q 92 24 84 24");
	expect(path).toContain("Q 80 24 80 36");
});
