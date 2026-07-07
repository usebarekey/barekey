<script lang="ts">
import { cn } from "$lib/utils.js";
import * as Sidebar from "$lib/components/ui/sidebar";
import barekey_logo from "$lib/assets/barekey/logo.png";

type DocsRoute = {
	category: string;
	slug: string;
};

type DocsNavEntry = {
	displayName?: string;
	path: string;
};

type DocsNavEntryGroup = Record<string, DocsNavEntry | undefined>;

type DocsNavGroup = {
	title: string;
	entries: DocsNavEntryGroup[];
};

type DocsContentMeta = Record<string, DocsNavGroup>;

const fallback_display_name = (slug: string) =>
	slug
		.split("-")
		.filter(Boolean)
		.map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
		.join(" ");

const get_docs_href = ({ category, slug }: DocsRoute) =>
	`/docs/${category}/${slug}`;

const get_docs_nav_groups = (meta: DocsContentMeta) => Object.entries(meta);

const get_docs_nav_group_entries = (nav_group: DocsNavGroup) =>
	nav_group.entries.flatMap((entry_group) =>
		Object.entries(entry_group).filter(
			(entry): entry is [string, DocsNavEntry] => entry[1] !== undefined,
		)
	);

const get_nav_entry_display_name = (slug: string, entry: DocsNavEntry) =>
	entry.displayName ?? fallback_display_name(slug);

let {
	content_meta,
	route,
}: {
	content_meta: DocsContentMeta;
	route: DocsRoute;
} = $props();

const current_href = $derived(get_docs_href(route));
</script>

<div class="t-sidebar-flyout flex min-w-0 flex-1 flex-col">
	<Sidebar.Header
		class="px-2 pr-14 transition-[padding] duration-(--resize-dur) ease-(--resize-ease)"
	>
		<div class="t-sidebar-flyout-inline">
			<div class="flex flex-row items-center gap-2">
				<img
					src={barekey_logo}
					alt=""
					class="size-5 shrink-0 invert dark:invert-0"
				/>
				<span class="font-logo barekey-gradient">Barekey</span>
			</div>
		</div>
	</Sidebar.Header>

	<Sidebar.Content class="px-2 pb-3">
    {#each get_docs_nav_groups(content_meta) as [category, nav_group] (category)}
      <Sidebar.Group class="px-0 py-1">
        <Sidebar.GroupLabel
          class="px-3 font-heading text-sm font-semibold text-foreground"
        >
          {nav_group.title}
        </Sidebar.GroupLabel>

        <Sidebar.MenuSub
          class="ml-3.5 mr-0 mt-2 gap-1.5 border-sidebar-border/70 py-1 pl-2 pr-0"
        >
          {#each get_docs_nav_group_entries(nav_group) as [slug, nav_entry] (`${category}/${slug}`)}
            {const title = get_nav_entry_display_name(slug, nav_entry)}
            {const href = get_docs_href({ category, slug })}

            <Sidebar.MenuSubItem>
              <a
                {href}
                aria-current={href === current_href ? "page" : undefined}
                data-active={href === current_href}
                data-sidebar="menu-sub-button"
                class={cn(
                  "group/docs-nav flex h-7 min-w-0 items-center rounded-full px-2.5 text-sm font-medium text-foreground transition-[background-color,color,box-shadow,transform] duration-(--duration-fast) ease-(--ease-smooth-out) outline-none hover:bg-linear-to-t hover:from-foreground/2.5 hover:to-foreground/7.5 hover:card focus-visible:ring-2 focus-visible:ring-ring/50 active:scale-[0.98] motion-reduce:transition-none",
                  href === current_href &&
                    "bg-linear-to-t from-foreground/2.5 to-foreground/7.5 card",
                )}
              >
                <span class="truncate">{title}</span>
              </a>
            </Sidebar.MenuSubItem>
          {/each}
        </Sidebar.MenuSub>
      </Sidebar.Group>
    {/each}
  </Sidebar.Content>
</div>

<style>
.barekey-gradient {
	display: inline-block;
	background-image: linear-gradient(
		to bottom,
		#ffd84d 0%,
		#f97316 28%,
		#ffe0b0 56%,
		#2563eb 100%
	);
	background-position: center;
	background-repeat: no-repeat;
	background-size: 100% 1em;
	background-clip: text;
	color: transparent;
	-webkit-background-clip: text;
	-webkit-text-fill-color: transparent;
}
</style>
