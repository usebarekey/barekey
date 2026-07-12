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

test("compact docs layout stacks the table of contents before the article", () => {
	expect(docs_frame).toMatch(/docs-article-surface[^\n]+order-last/);
	expect(docs_frame).toMatch(/docs-toc-surface[^\n]+order-first/);
	expect(docs_frame).toContain("xl:order-first");
	expect(docs_frame).toContain("xl:order-last");
});

test("compact docs surfaces share one vertical scroll root", () => {
	expect(docs_frame).toMatch(/docs-responsive-surfaces[^\n]+overflow-y-auto/);
	expect(docs_frame).toContain("table_of_contents(toc_scroll_root)");
	expect(docs_frame).toContain("overflow: visible !important");
});

test("compact docs layout uses a sticky branded glass header", () => {
	const mobile_header = readFileSync(
		"src/routes/docs/[category]/[slug]/components/docs-mobile-header.sv",
		"utf8",
	);

	expect(docs_frame).toContain("<DocsMobileHeader />");
	expect(docs_frame).not.toContain('class="flex w-12 shrink-0');
	expect(mobile_header).toContain("sticky top-0");
	expect(mobile_header).toContain("justify-between");
	expect(mobile_header).toContain("backdrop-blur-xl");
	expect(mobile_header).toContain("Barekey");
	expect(mobile_header).toContain('aria-label="Open documentation navigation"');
});

test("docs viewport follows mobile browser chrome and resets after navigation", () => {
	expect(docs_frame).toContain("h-dvh max-h-dvh");
	expect(docs_frame).toContain("env(safe-area-inset-bottom)");
	expect(docs_frame).toContain("page_key: string;");
	expect(docs_frame).toContain("compact_scroll_root?.scrollTo({ top: 0 });");
	expect(docs_frame).toContain("article_viewport?.scrollTo({ top: 0 });");
});

test("mobile documentation drawer is an edge-attached panel with a visible close button", () => {
	const sidebar = readFileSync("src/lib/components/ui/sidebar/sidebar.sv", "utf8");

	expect(sidebar).toContain("inset-y-0 left-0 h-full");
	expect(sidebar).toContain("rounded-l-none rounded-r-2xl border-0 p-0 card");
	expect(sidebar).not.toContain("inset-y-2 left-2 h-auto");
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
