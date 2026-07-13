import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

const frontend_root = new URL("../", import.meta.url);

const package_categories = [
	"auto-href",
	"build-og",
	"global-typescript",
	"memorystore",
	"plugin-composer",
	"runtime-checker",
	"sv-extension",
] as const;

const package_managers = ["deno", "bun", "pnpm", "npm", "yarn", "nub", "aube", "vlt"] as const;

const read_source = (path: string) => readFile(new URL(path, frontend_root), "utf8");

describe("package documentation", () => {
	it.each(package_categories)("offers every package manager for %s", async (category) => {
		const source = await read_source(`src/content/${category}/installation.mdx`);

		expect(source.match(/<CommandPicker\.Item/g)).toHaveLength(package_managers.length);

		for (const package_manager of package_managers) {
			expect(source).toContain(`value="${package_manager}"`);
		}
	});

	it("demonstrates browser-native styling in the build-og introduction", async () => {
		const introduction = await read_source("src/content/build-og/introduction.mdx");

		expect(introduction).toContain("## The problem");
		expect(introduction).toContain("artisan-neo-variable.woff2");
		expect(introduction).toContain("bg-zinc-950");
		expect(introduction).toContain("document.fonts.ready");
	});

	it("renders the docs OG card with Tailwind and a preloaded font asset", async () => {
		const [card, route, server_route] = await Promise.all([
			read_source("src/lib/components/og/og-card.sv"),
			read_source("src/routes/og/docs/[category]/[slug]/+page.sv"),
			read_source("src/routes/og/docs/[category]/[slug]/+page.server.ts"),
		]);

		expect(card).toContain("bg-linear-to-b");
		expect(card).not.toContain("<style>");
		expect(route).toContain("artisan-neo-variable.woff2");
		expect(route).toContain('rel="preload"');
		expect(server_route).toContain('query: "?raw"');
		expect(server_route).not.toContain("LoadDocsContent");
	});

	it("uses a serverless Chromium binary for Vercel builds", async () => {
		const [package_source, build_og_patch] = await Promise.all([
			read_source("package.json"),
			read_source("patches/svelte-build-og@0.1.0.patch"),
		]);
		const package_json = JSON.parse(package_source) as {
			devDependencies: Record<string, string>;
		};

		expect(package_json.devDependencies["@sparticuz/chromium"]).toBe("149.0.0");
		expect(build_og_patch).toContain("process.env.VERCEL");
		expect(build_og_patch).toContain("serverless_chromium.args");
		expect(build_og_patch).toContain("serverless_chromium.executablePath()");
		expect(build_og_patch).toContain("noDiscovery: true");
		expect(build_og_patch).toContain("concurrency: process.env.VERCEL ? 1 : 4");
	});
});
