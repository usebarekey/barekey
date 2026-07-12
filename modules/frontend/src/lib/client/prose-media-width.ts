import { Effect, Layer } from "effect";

const prose_selector = ".prose";
const media_scope_selector = "[data-prose-media-scope]";
const width_source_selector = ".docs-code-snippet";
const code_snippet_body_selector = ".docs-code-snippet-body";
const media_width_property = "--docs-prose-media-width";

const get_code_snippet_width = (code_snippet: HTMLElement) => {
	const code_snippet_width = code_snippet.getBoundingClientRect().width;
	const body = code_snippet.querySelector<HTMLElement>(code_snippet_body_selector);

	if (!body) {
		return Math.ceil(code_snippet_width);
	}

	const body_border_width = body.getBoundingClientRect().width - body.clientWidth;
	const body_content_width = body.scrollWidth + body_border_width;

	return Math.ceil(Math.max(code_snippet_width, body_content_width));
};

const get_largest_code_snippet_width = (prose: HTMLElement) => {
	const widths = Array.from(
		prose.querySelectorAll<HTMLElement>(width_source_selector),
		get_code_snippet_width,
	);

	return Math.max(0, ...widths);
};

const observe_prose_containers = (
	resize_observer: ResizeObserver,
	observed_media_scopes: WeakSet<HTMLElement>,
	observed_prose: WeakSet<HTMLElement>,
) => {
	for (const prose of document.querySelectorAll<HTMLElement>(prose_selector)) {
		const media_scope = prose.closest<HTMLElement>(media_scope_selector);

		if (media_scope && !observed_media_scopes.has(media_scope)) {
			observed_media_scopes.add(media_scope);
			resize_observer.observe(media_scope);
		}

		if (!observed_prose.has(prose)) {
			observed_prose.add(prose);
			resize_observer.observe(prose);
		}
	}
};

const sync_prose_media_widths = (
	resize_observer: ResizeObserver,
	observed_media_scopes: WeakSet<HTMLElement>,
	observed_prose: WeakSet<HTMLElement>,
) =>
	Effect.sync(() => {
		observe_prose_containers(resize_observer, observed_media_scopes, observed_prose);

		const measurements = Array.from(
			document.querySelectorAll<HTMLElement>(prose_selector),
			(prose) => ({
				media_scope: prose.closest<HTMLElement>(media_scope_selector) ?? prose,
				width: get_largest_code_snippet_width(prose),
			}),
		);

		for (const { media_scope, width } of measurements) {
			if (width <= 0) {
				media_scope.style.removeProperty(media_width_property);
				continue;
			}

			media_scope.style.setProperty(media_width_property, `${width}px`);
		}
	});

/** Synchronizes prose media widths for the lifetime of the client runtime. */
export const ProseMediaWidthLive = Layer.effectDiscard(
	Effect.acquireRelease(
		Effect.sync(() => {
			const observed_media_scopes = new WeakSet<HTMLElement>();
			const observed_prose = new WeakSet<HTMLElement>();
			let sync_frame: number | undefined;

			const run_sync = () => {
				Effect.runSync(
					sync_prose_media_widths(resize_observer, observed_media_scopes, observed_prose),
				);
			};

			const schedule_sync = () => {
				if (sync_frame !== undefined) {
					return;
				}

				sync_frame = requestAnimationFrame(() => {
					sync_frame = undefined;
					run_sync();
				});
			};

			const resize_observer = new ResizeObserver(schedule_sync);
			const mutation_observer = new MutationObserver(() => {
				observe_prose_containers(resize_observer, observed_media_scopes, observed_prose);
				schedule_sync();
			});
			const visual_viewport = document.defaultView?.visualViewport;

			observe_prose_containers(resize_observer, observed_media_scopes, observed_prose);
			schedule_sync();
			mutation_observer.observe(document.documentElement, {
				childList: true,
				subtree: true,
			});
			globalThis.addEventListener("resize", schedule_sync);
			visual_viewport?.addEventListener("resize", schedule_sync);
			void document.fonts?.ready.then(schedule_sync);

			return {
				mutation_observer,
				resize_observer,
				schedule_sync,
				visual_viewport,
				get_sync_frame: () => sync_frame,
			};
		}),
		({ mutation_observer, resize_observer, schedule_sync, visual_viewport, get_sync_frame }) =>
			Effect.sync(() => {
				const sync_frame = get_sync_frame();

				mutation_observer.disconnect();
				resize_observer.disconnect();
				globalThis.removeEventListener("resize", schedule_sync);
				visual_viewport?.removeEventListener("resize", schedule_sync);

				if (sync_frame !== undefined) {
					cancelAnimationFrame(sync_frame);
				}
			}),
	),
);
