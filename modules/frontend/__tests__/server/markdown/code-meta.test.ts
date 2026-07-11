import { Effect } from "effect";
import { expect, test } from "vitest";
import {
	get_file_icon_label,
	get_svgl_icon_name,
} from "$lib/components/markdown/file-icon-data.ts";
import { get_file_icon_identifier } from "$lib/data/icon-identifiers.ts";
import { ParseCodeMeta, get_code_icon_source } from "$lib/server/markdown/components/code-meta.ts";

test("code metadata keeps explicit icon override", async () => {
	const meta = await Effect.runPromise(
		ParseCodeMeta(
			'diff name="vite.config.ts" icon="svelte" line="100" char="17" link="https://github.com/example/repo/blob/main/vite.config.ts#L100"',
		),
	);

	expect(meta.name).toBe("vite.config.ts");
	expect(meta.icon).toBe("svelte");
	expect(meta.line).toBe(100);
	expect(meta.char).toBe(17);
	expect(meta.link).toBe("https://github.com/example/repo/blob/main/vite.config.ts#L100");
	expect(get_code_icon_source(meta)).toBe("svelte");
});

test("code metadata preserves zero coordinates and ignores invalid values", async () => {
	const zero = await Effect.runPromise(ParseCodeMeta('line="0" char="0"'));
	const invalid = await Effect.runPromise(ParseCodeMeta('line="first" char="2.5"'));

	expect(zero.line).toBe(0);
	expect(zero.char).toBe(0);
	expect(invalid.line).toBeUndefined();
	expect(invalid.char).toBeUndefined();
});

test("code icon source resolves explicit icon before filename", async () => {
	const meta = await Effect.runPromise(ParseCodeMeta('diff name="vite.config.ts" icon="svelte"'));
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

test("package manager icons use SVGL where available", () => {
	expect(get_svgl_icon_name("vlt")).toBe("Vlt");
	expect(get_svgl_icon_name("deno")).toBe("Deno");
	expect(get_svgl_icon_name("bun")).toBe("Bun");
});

test("file icon text fallbacks stay to one initial", () => {
	expect(get_file_icon_label("aube")).toBe("A");
	expect(get_file_icon_label("nub")).toBe("N");
	expect(get_file_icon_label("vlt")).toBe("V");
});
