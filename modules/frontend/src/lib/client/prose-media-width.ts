import { Effect } from "effect";

declare global {
  var __barekey_prose_media_width: boolean | undefined;
}

const prose_selector = ".prose";
const media_scope_selector = "[data-prose-media-scope]";
const width_source_selector = ".docs-code-snippet";
const media_width_property = "--docs-prose-media-width";

const observed_media_scopes = new WeakSet<HTMLElement>();
const observed_prose = new WeakSet<HTMLElement>();
let sync_frame: number | undefined;
let resize_observer: ResizeObserver | undefined;

const get_largest_code_snippet_width = (prose: HTMLElement) => {
  const widths = Array.from(
    prose.querySelectorAll<HTMLElement>(width_source_selector),
    (element) => Math.ceil(element.getBoundingClientRect().width),
  );

  return Math.max(0, ...widths);
};

const observe_prose_containers = () => {
  for (
    const prose of document.querySelectorAll<HTMLElement>(prose_selector)
  ) {
    const media_scope = prose.closest<HTMLElement>(media_scope_selector);

    if (media_scope && !observed_media_scopes.has(media_scope)) {
      observed_media_scopes.add(media_scope);
      resize_observer?.observe(media_scope);
    }

    if (!observed_prose.has(prose)) {
      observed_prose.add(prose);
      resize_observer?.observe(prose);
    }
  }
};

const sync_prose_media_widths = Effect.sync(() => {
  observe_prose_containers();

  for (
    const prose of document.querySelectorAll<HTMLElement>(prose_selector)
  ) {
    const media_scope = prose.closest<HTMLElement>(media_scope_selector) ??
      prose;

    prose.style.removeProperty(media_width_property);
    media_scope.style.removeProperty(media_width_property);

    const width = get_largest_code_snippet_width(prose);

    if (width <= 0) {
      continue;
    }

    media_scope.style.setProperty(media_width_property, `${width}px`);
  }
});

const schedule_prose_media_width_sync = () => {
  if (sync_frame !== undefined) {
    return;
  }

  sync_frame = requestAnimationFrame(() => {
    sync_frame = undefined;
    Effect.runSync(sync_prose_media_widths);
  });
};

const setup_prose_media_width_sync = Effect.sync(() => {
  resize_observer = new ResizeObserver(schedule_prose_media_width_sync);
  observe_prose_containers();
  schedule_prose_media_width_sync();

  const mutation_observer = new MutationObserver(() => {
    observe_prose_containers();
    schedule_prose_media_width_sync();
  });
  mutation_observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
  });

  const visual_viewport = document.defaultView?.visualViewport;

  globalThis.addEventListener("resize", schedule_prose_media_width_sync);
  visual_viewport?.addEventListener(
    "resize",
    schedule_prose_media_width_sync,
  );

  document.fonts?.ready.then(schedule_prose_media_width_sync);
});

if (typeof document !== "undefined" && !globalThis.__barekey_prose_media_width) {
  globalThis.__barekey_prose_media_width = true;
  Effect.runSync(setup_prose_media_width_sync);
}
