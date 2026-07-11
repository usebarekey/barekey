<script lang="ts" effect>
import { capture_event, get_page_path } from "$lib/client/analytics";
import { Effect } from "effect";
import type { Action } from "svelte/action";
import ListLetters from "@tabler/icons-svelte/icons/list-letters";

type DocsTocEntry = {
	id: string;
	title: string;
	depth: number;
};

type DocsTocHeader = {
	id: string;
	title: string;
};

type TocTrackingState = {
	article_viewport: HTMLElement | null;
	entries: DocsTocEntry[];
};

let {
	article_viewport,
	entries,
	header,
}: {
	article_viewport: HTMLElement | null;
	entries: DocsTocEntry[];
	header: DocsTocHeader;
} = $props();
let active_toc_id = $state("");
let toc_progress = $state("0%");

const toc_entries = $derived([{ ...header, depth: 1 }, ...entries]);
const toc_tracking = $derived({ article_viewport, entries: toc_entries });

const set_active_toc_id = (id: string) => {
	active_toc_id = id;
};

const set_toc_progress = (progress: string) => {
	toc_progress = progress;
};

const toc_line_base = 8;
const toc_line_inset_y = 6;
const toc_line_turn_y = 12;

const get_toc_line_offset = (depth: number) => {
	if (depth <= 1) return toc_line_base;
	if (depth === 2) return toc_line_base + 12;

	return toc_line_base + 24;
};

const get_toc_item_style = (depth: number) =>
	`padding-left: ${(get_toc_line_offset(depth) + 12).toString()}px`;

const get_toc_line_context = (index: number, depth: number) => {
	const current = get_toc_line_offset(depth);
	const previous_entry = toc_entries[index - 1];
	const previous = previous_entry
		? get_toc_line_offset(previous_entry.depth)
		: current;
	const next_entry = toc_entries[index + 1];
	const next = next_entry ? get_toc_line_offset(next_entry.depth) : current;
	const is_first = index === 0;
	const is_last = index === toc_entries.length - 1;
	const clip_top = is_first ? toc_line_inset_y : 0;
	const clip_bottom = is_last
		? toc_line_inset_y
		: current > next
			? toc_line_turn_y
			: 0;

	return {
		current,
		next,
		previous,
		line_start: previous < current ? toc_line_turn_y : "0",
		line_end: "100%",
		turn_y: toc_line_turn_y,
		svg_style: [
			`width: ${(Math.max(previous, current) + 9).toString()}px`,
			"height: 100%",
			`clip-path: inset(${clip_top}px 0 ${clip_bottom}px 0)`,
		].join("; "),
		turn_out_style: [
			`width: ${(Math.max(current, next) + 9).toString()}px`,
			`height: ${toc_line_turn_y.toString()}px`,
		].join("; "),
	};
};

const get_content_heading = (
	scroll_root: HTMLElement | null,
	id: string,
) => scroll_root?.querySelector<HTMLElement>(`#${CSS.escape(id)}`) ?? null;

const get_scroll_progress = (scroll_root: HTMLElement | null) => {
	if (!scroll_root) return 0;

	const max_scroll = scroll_root.scrollHeight - scroll_root.clientHeight;

	return max_scroll <= 0
		? 1
		: Math.min(Math.max(scroll_root.scrollTop / max_scroll, 0), 1);
};

const is_scroll_at_end = (scroll_root: HTMLElement | null) => {
	if (!scroll_root) return false;

	const max_scroll = scroll_root.scrollHeight - scroll_root.clientHeight;

	return max_scroll > 0 && max_scroll - scroll_root.scrollTop <= 2;
};

const get_toc_activation_y = (scroll_root: HTMLElement | null) => {
	const rect = scroll_root?.getBoundingClientRect();

	if (!rect) return 96;

	const reading_offset = Math.min(Math.max(rect.height * 0.5, 240), 560);

	return rect.top + reading_offset;
};

const UpdateTocState = (tracking: TocTrackingState) =>
	Effect.sync(() => {
		const { article_viewport: scroll_root, entries: current_entries } =
			tracking;
		const scroll_progress = get_scroll_progress(scroll_root);

		set_toc_progress(`${(scroll_progress * 100).toFixed(3)}%`);

		if (!current_entries.length) {
			set_active_toc_id("");
			return;
		}

		const headings = current_entries.flatMap((entry) => {
			const heading = get_content_heading(scroll_root, entry.id);

			return heading ? [{ id: entry.id, heading }] : [];
		});

		if (!headings.length) {
			set_active_toc_id(current_entries[0]?.id ?? "");
			return;
		}

		if (is_scroll_at_end(scroll_root)) {
			set_active_toc_id(headings.at(-1)?.id ?? "");
			return;
		}

		const activation_y = get_toc_activation_y(scroll_root);
		let active_id = headings[0]!.id;

		for (const { id, heading } of headings) {
			if (heading.getBoundingClientRect().top > activation_y) break;

			active_id = id;
		}

		set_active_toc_id(active_id);
	});

const SetupActiveTocTracking = (tracking: TocTrackingState) =>
	Effect.gen(function* () {
		const { article_viewport: scroll_root } = tracking;

		if (!scroll_root) {
			yield* UpdateTocState(tracking);

			return () => {};
		}

		const controller = new AbortController();
		let frame: number | null = null;

		const schedule_update = () => {
			if (frame !== null) return;

			frame = window.requestAnimationFrame(() => {
				frame = null;
				Effect.runSync(UpdateTocState(tracking));
			});
		};

		scroll_root.addEventListener("scroll", schedule_update, {
			passive: true,
			signal: controller.signal,
		});
		window.addEventListener("resize", schedule_update, {
			signal: controller.signal,
		});

		yield* UpdateTocState(tracking);

		return () => {
			controller.abort();

			if (frame !== null) {
				window.cancelAnimationFrame(frame);
			}
		};
	});

const track_active_toc: Action<HTMLElement, TocTrackingState> = (
	_node,
	tracking,
) => {
	let cleanup = Effect.runSync(SetupActiveTocTracking(tracking));

	return {
		update(next_tracking) {
			cleanup();
			cleanup = Effect.runSync(SetupActiveTocTracking(next_tracking));
		},
		destroy() {
			cleanup();
		},
	};
};

const ScrollToHeading = (
	event: MouseEvent,
	id: string,
	scroll_root: HTMLElement | null,
) =>
	Effect.sync(() => {
		if (
			event.button !== 0 ||
			event.metaKey ||
			event.ctrlKey ||
			event.shiftKey ||
			event.altKey
		) {
			return;
		}

		const heading = get_content_heading(scroll_root, id);

		if (!heading) {
			return;
		}

		event.preventDefault();
		set_active_toc_id(id);

		const hash = `#${id}`;

		if (location.hash !== hash) {
			history.pushState(null, "", hash);
		}

		heading.scrollIntoView({
			block: "start",
			behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
				? "auto"
				: "smooth",
		});

		capture_event("toc_heading_clicked", {
			heading_id: id,
			page_path: get_page_path(),
		});
	});
</script>

<div class="flex min-h-full flex-col gap-4 p-7">
  <div class="flex flex-row items-center gap-2">
    <ListLetters class="size-4 text-muted-foreground" />
    <span class="whitespace-nowrap text-xs uppercase text-muted-foreground">
      On this page
    </span>
  </div>

  {#if toc_entries.length}
    <nav aria-label="On this page" use:track_active_toc={toc_tracking}>
      <div
        class="relative flex flex-col text-sm"
        style={`--toc-progress: ${toc_progress};`}
      >
        <div
          aria-hidden="true"
          class="docs-toc-progress-mask pointer-events-none absolute inset-0 z-20 flex flex-col overflow-hidden text-foreground"
        >
          {#each toc_entries as entry, index (entry.id)}
            {const line = get_toc_line_context(index, entry.depth)}
            <div
              class="relative block break-words py-1.5 font-medium leading-snug"
              style={get_toc_item_style(entry.depth)}
            >
              <svg
                aria-hidden="true"
                class="pointer-events-none absolute left-0 top-0 z-0 overflow-visible"
                style={line.svg_style}
              >
                {#if line.previous < line.current}
                  <path
                    d={`M ${line.previous + 0.5} 0 L ${line.current + 0.5} ${line.turn_y}`}
                    stroke="currentColor"
                    stroke-width="1"
                    stroke-linecap="butt"
                    fill="none"
                    vector-effect="non-scaling-stroke"
                  />
                {/if}
                <line
                  x1={line.current + 0.5}
                  y1={line.line_start}
                  x2={line.current + 0.5}
                  y2={line.line_end}
                  stroke="currentColor"
                  stroke-width="1"
                  stroke-linecap="butt"
                  vector-effect="non-scaling-stroke"
                />
              </svg>
              {#if line.current > line.next}
                <svg
                  aria-hidden="true"
                  class="pointer-events-none absolute bottom-0 left-0 z-0 overflow-visible"
                  style={line.turn_out_style}
                >
                  <path
                    d={`M ${line.current + 0.5} 0 L ${line.next + 0.5} ${line.turn_y}`}
                    stroke="currentColor"
                    stroke-width="1"
                    stroke-linecap="butt"
                    fill="none"
                    vector-effect="non-scaling-stroke"
                  />
                </svg>
              {/if}
              <span class="text-transparent">{entry.title}</span>
            </div>
          {/each}
        </div>

        {#each toc_entries as entry, index (entry.id)}
          {const line = get_toc_line_context(index, entry.depth)}
          <a
            href={`#${entry.id}`}
            onclick={yield* ScrollToHeading(event, entry.id, article_viewport)}
            aria-current={active_toc_id === entry.id ? "location" : undefined}
            class={`isolate relative block break-words rounded-md py-1.5 font-medium leading-snug transition-colors duration-(--duration-fast) ease-in-out hover:text-foreground focus-visible:text-foreground motion-reduce:transition-none ${
              active_toc_id === entry.id
                ? "text-foreground"
                : "text-muted-foreground"
            }`}
            style={get_toc_item_style(entry.depth)}
          >
            <svg
              aria-hidden="true"
              class="pointer-events-none absolute left-0 top-0 z-0 overflow-visible"
              style={line.svg_style}
            >
              <g class="text-muted-foreground/35">
                {#if line.previous < line.current}
                  <path
                    d={`M ${line.previous + 0.5} 0 L ${line.current + 0.5} ${line.turn_y}`}
                    stroke="currentColor"
                    stroke-width="1"
                    stroke-linecap="butt"
                    fill="none"
                    vector-effect="non-scaling-stroke"
                  />
                {/if}
                <line
                  x1={line.current + 0.5}
                  y1={line.line_start}
                  x2={line.current + 0.5}
                  y2={line.line_end}
                  stroke="currentColor"
                  stroke-width="1"
                  stroke-linecap="butt"
                  vector-effect="non-scaling-stroke"
                />
              </g>
            </svg>
            {#if line.current > line.next}
              <svg
                aria-hidden="true"
                class="pointer-events-none absolute bottom-0 left-0 z-0 overflow-visible"
                style={line.turn_out_style}
              >
                <g class="text-muted-foreground/35">
                  <path
                    d={`M ${line.current + 0.5} 0 L ${line.next + 0.5} ${line.turn_y}`}
                    stroke="currentColor"
                    stroke-width="1"
                    stroke-linecap="butt"
                    fill="none"
                    vector-effect="non-scaling-stroke"
                  />
                </g>
              </svg>
            {/if}
            <span class="relative z-10">{entry.title}</span>
          </a>
        {/each}
      </div>
    </nav>
  {/if}
</div>

<style>
.docs-toc-progress-mask {
	clip-path: inset(0 0 calc(100% - var(--toc-progress, 0%)) 0);
	transition: clip-path var(--duration-fast) var(--ease-smooth-out);
	will-change: clip-path;
}

@media (prefers-reduced-motion: reduce) {
	.docs-toc-progress-mask {
		transition: none;
	}
}
</style>
