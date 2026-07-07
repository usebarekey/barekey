import { expect, test } from "vitest";
import { get_file_icon_identifier } from "../../../src/lib/server/data/icon-identifiers.ts";
import {
	get_code_icon_source,
	parse_code_meta,
} from "../../../src/lib/server/markdown/components/code-meta.ts";

test("code metadata keeps explicit icon override", () => {
	const meta = parse_code_meta('diff name="vite.config.ts" icon="svelte"');

	expect(meta.name).toBe("vite.config.ts");
	expect(meta.icon).toBe("svelte");
	expect(get_code_icon_source(meta)).toBe("svelte");
});

test("code icon source resolves explicit icon before filename", () => {
	const meta = parse_code_meta('diff name="vite.config.ts" icon="svelte"');
	const icon_source = get_code_icon_source(meta);

	expect(get_file_icon_identifier(icon_source)).toBe("svelte");
});

test("file icon lookup accepts bare icon names", () => {
	expect(get_file_icon_identifier("svelte")).toBe("svelte");
});

test("file icon lookup accepts package manager icon names", () => {
	for (const package_manager of ["aube", "bun", "deno", "npm", "nub", "pnpm", "vlt", "yarn"]) {
		expect(get_file_icon_identifier(package_manager)).toBe(package_manager);
	}
});
