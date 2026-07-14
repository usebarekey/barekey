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

	it("allows Memory Store build scripts and runs its local binary", async () => {
		const installation = await read_source("src/content/memorystore/installation.mdx");

		expect(installation).toContain(
			"deno add --node-modules-dir=auto --allow-scripts=npm:@barekey/memorystore",
		);
		expect(installation).toContain("pnpm add --allow-build=@barekey/memorystore");
		expect(installation).toContain("npx memorystore-mcp --root /path/to/project init");
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
		expect(server_route).toContain("LoadDocsContent");
		expect(server_route).not.toContain('query: "?raw"');
	});

	it("uses the published serverless browser provider for Vercel builds", async () => {
		const [package_source, vite_config, workspace] = await Promise.all([
			read_source("package.json"),
			read_source("vite.config.ts"),
			read_source("pnpm-workspace.yaml"),
		]);
		const package_json = JSON.parse(package_source) as {
			dependencies: Record<string, string>;
			devDependencies: Record<string, string>;
		};

		expect(package_json.devDependencies["@sparticuz/chromium"]).toBe("149.0.0");
		expect(package_json.devDependencies["svelte-build-og"]).toBe("0.3.0");
		expect(package_json.dependencies).not.toHaveProperty("yaml");
		expect(vite_config).toContain("include_og_types");
		expect(vite_config).toContain("process.env.VERCEL");
		expect(vite_config).toContain("serverless_chromium(chromium)");
		expect(vite_config).toContain('sveltekit_out_dir: ".svelte-kit"');
		expect(workspace).not.toContain("patchedDependencies");
	});
});
