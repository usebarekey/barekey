import { readFileSync } from "node:fs";
import { expect, test } from "vitest";

const docs_frame = readFileSync(
	"src/routes/docs/[category]/[slug]/components/docs-page-frame.sv",
	"utf8",
);

test("compact docs layout uses a drawer breakpoint that includes tablets", () => {
	expect(docs_frame).toContain("mobile_breakpoint={1280}");
	expect(docs_frame).toContain('new MediaQuery("(max-width: 1279px)")');
});

test("desktop docs sidebar has a stable server-rendered width", () => {
	const docs_sidebar = readFileSync(
		"src/routes/docs/[category]/[slug]/components/docs-sidebar.sv",
		"utf8",
	);

	expect(docs_frame).toContain("--sidebar-width: 16rem;");
	expect(docs_frame).not.toContain("--docs-sidebar-natural-width");
	expect(docs_sidebar).not.toContain("set_sidebar_natural_width");
});

test("compact docs layout stacks the table of contents before the article", () => {
	expect(docs_frame).toMatch(/docs-article-surface[^\n]+order-last/);
	expect(docs_frame).toMatch(/docs-toc-surface[^\n]+order-first/);
});

test("compact docs use document flow instead of nested scroll areas", () => {
	expect(docs_frame).toContain("{#if compact_layout.current}");
	expect(docs_frame).toContain("<section");
	expect(docs_frame).toContain("<article");
	expect(docs_frame).toContain("table_of_contents(null)");
	expect(docs_frame).not.toContain("overflow-y-auto");
	expect(docs_frame).not.toContain("compact_scroll_root");
});

test("docs card inset preserves inner rounding and outer shadows", () => {
	expect(docs_frame).toMatch(/docs-toc-surface[^\n]+p-1 card/);
	expect(docs_frame).toMatch(/docs-article-surface[^\n]+p-1 card/);
	expect(docs_frame).toContain("border-radius: calc(var(--radius-3xl) - 0.25rem);");
	expect(
		docs_frame.match(/overflow-hidden rounded-\[calc\(var\(--radius-2xl\)-0\.25rem\)\]/g),
	).toHaveLength(2);
	expect(docs_frame).not.toContain("rounded-[calc(var(--radius-2xl)-0.25rem)] bg-background");
});

test("compact docs layout uses a sticky branded glass header", () => {
	const mobile_header = readFileSync(
		"src/routes/docs/[category]/[slug]/components/docs-mobile-header.sv",
		"utf8",
	);

	expect(docs_frame).toContain("<DocsMobileHeader />");
	expect(docs_frame).not.toContain('class="flex w-12 shrink-0');
	expect(mobile_header).toContain("sticky top-2 z-20 order-first");
	expect(mobile_header).toContain("justify-between");
	expect(mobile_header).toContain("rounded-full");
	expect(mobile_header).toContain("from-white/18 to-white/8");
	expect(mobile_header).toContain("border-white/18");
	expect(mobile_header).toContain("backdrop-blur-xl");
	expect(mobile_header).toContain("Barekey");
	expect(mobile_header).toContain('aria-label="Open documentation navigation"');
	expect(mobile_header).toContain('variant="default"');
	expect(mobile_header).toContain('size="icon"');
	expect(mobile_header).toContain(
		"rounded-full bg-transparent! bg-linear-to-b from-foreground-extra/5 to-foreground-extra/[2.5%]",
	);
	expect(mobile_header).toContain("text-foreground-extra card");
	expect(mobile_header).not.toContain("LayoutSidebar");
});

test("docs viewport follows mobile browser chrome and resets after navigation", () => {
	expect(docs_frame).toContain("min-h-dvh");
	expect(docs_frame).toContain("env(safe-area-inset-bottom)");
	expect(docs_frame).toContain("page_key: string;");
	expect(docs_frame).toContain("window.scrollTo({ top: 0 });");
	expect(docs_frame).toContain("article_viewport?.scrollTo({ top: 0 });");
});

test("mobile table of contents tracks document scrolling", () => {
	const table_of_contents = readFileSync(
		"src/routes/docs/[category]/[slug]/components/docs-table-of-contents.sv",
		"utf8",
	);

	expect(table_of_contents).toContain("scroll_root ?? document.documentElement");
	expect(table_of_contents).toContain("scroll_root ?? window");
	expect(table_of_contents).toContain("scroll_root ?? document");
});

test("mobile documentation drawer is an edge-attached panel with a visible close button", () => {
	const sidebar = readFileSync("src/lib/components/ui/sidebar/sidebar.sv", "utf8");
	const sidebar_css = readFileSync("src/lib/styles/sidebar.css", "utf8");

	expect(sidebar).toContain("inset-y-2 left-0 h-auto");
	expect(sidebar).toContain("w-[min(var(--sidebar-width),calc(100vw-0.5rem))]");
	expect(sidebar).toContain("rounded-l-none rounded-r-2xl border-0 p-0 card");
	expect(sidebar).not.toContain("inset-y-2 left-2 h-auto");
	expect(sidebar).not.toContain("docs-mobile-sidebar");
	expect(sidebar_css).not.toContain(".docs-mobile-sidebar");
	expect(sidebar).toContain('closeButtonClass="top-2 right-2 size-10 rounded-full');
	expect(sidebar).toContain('onCloseButtonClick={() => play("toggle")}');
	expect(sidebar).not.toContain("[&>button]:hidden");
});

test("mobile documentation drawer uses interruptible panel motion", () => {
	const sidebar = readFileSync("src/lib/components/ui/sidebar/sidebar.sv", "utf8");
	const sidebar_css = readFileSync("src/lib/styles/sidebar.css", "utf8");

	expect(sidebar).toContain('motion="none"');
	expect(sidebar).toContain("t-panel-slide-x");
	expect(sidebar_css).toContain(".t-panel-slide-x[data-starting-style]");
	expect(sidebar_css).toContain(".t-panel-slide-x[data-ending-style]");
	expect(sidebar_css).toMatch(
		/@media \(prefers-reduced-motion: reduce\)[\s\S]*?\.t-panel-slide-x[\s\S]*?transition: none !important/,
	);
});

test("mobile documentation drawer closes after selecting a page", () => {
	const docs_sidebar = readFileSync(
		"src/routes/docs/[category]/[slug]/components/docs-sidebar.sv",
		"utf8",
	);

	expect(docs_sidebar).toContain("if (sidebar_state.is_mobile)");
	expect(docs_sidebar).toContain("sidebar_state.set_open_mobile(false)");
});

test("mobile documentation drawer aligns its brand with the navigation heading", () => {
	const docs_sidebar = readFileSync(
		"src/routes/docs/[category]/[slug]/components/docs-sidebar.sv",
		"utf8",
	);

	expect(docs_sidebar).toContain('class="pl-6 pr-14 xl:pl-2"');
	expect(docs_sidebar).toContain("t-sidebar-child -ml-1 flex");
	expect(docs_sidebar).toContain("xl:ml-0");
});

test("long page titles wrap at semantic boundaries without overflowing", () => {
	const docs_article = readFileSync(
		"src/routes/docs/[category]/[slug]/components/docs-article.sv",
		"utf8",
	);
	const headings_css = readFileSync("src/lib/styles/prose/headings.css", "utf8");

	expect(docs_article).toContain("title_segments");
	expect(docs_article).toContain("<wbr />");
	expect(docs_article).toContain("docs-page-title");
	expect(headings_css).toMatch(
		/\.docs-page-title \{[\s\S]*?max-width: 100%;[\s\S]*?overflow-wrap: anywhere;[\s\S]*?text-wrap: balance;/,
	);
});
