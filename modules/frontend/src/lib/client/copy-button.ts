import { capture_event, get_page_path } from "$lib/client/analytics";
import { Data, Effect, Fiber, Layer } from "effect";
import { play } from "cuelume";

export class ClipboardWriteError extends Data.TaggedError("ClipboardWriteError")<{
	cause?: unknown;
	message: string;
}> {}

type CopyButtonState = {
	copy_promise?: Promise<void>;
	feedback?: HTMLElement;
	position_frame?: number;
	queued: boolean;
	reposition_cleanup?: () => void;
	reset_fiber?: Fiber.Fiber<void, never>;
};

const clipboard_write_timeout_ms = 800;
const copied_hold_ms = 1400;
const copy_button_selector =
	"button.docs-copy-button, button.docs-code-snippet-copy, button.docs-heading-copy";
const command_snippet_selector = "[data-command-snippet]";

const states = new WeakMap<HTMLButtonElement, CopyButtonState>();
const known_buttons = new Set<HTMLButtonElement>();

const get_copy_state = (button: HTMLButtonElement) => {
	const state = states.get(button) ?? {
		copy_promise: undefined,
		feedback: undefined,
		position_frame: undefined,
		queued: false,
		reposition_cleanup: undefined,
		reset_fiber: undefined,
	};

	states.set(button, state);
	known_buttons.add(button);

	return state;
};

const get_feedback = (button: HTMLButtonElement, state: CopyButtonState) => {
	if (state.feedback?.isConnected) {
		return state.feedback;
	}

	const feedback = button.querySelector<HTMLElement>('[data-slot="floating-feedback"]');

	if (!feedback) {
		return undefined;
	}

	document.body.append(feedback);
	state.feedback = feedback;

	return feedback;
};

const get_code_text = (button: HTMLButtonElement) => {
	const snippet = button.closest(".docs-code-snippet");
	const code = snippet?.querySelector("code");

	return code?.textContent ?? "";
};

const get_heading_link_text = (button: HTMLButtonElement) => {
	const heading_id = button.dataset.headingId ?? button.closest("[id]")?.id;

	if (!heading_id) {
		return "";
	}

	const url = new URL(globalThis.location.href);
	url.hash = heading_id;

	return url.href;
};

const get_command_text = (button: HTMLButtonElement) => {
	const snippet = button.closest<HTMLElement>(command_snippet_selector);
	const selected_value = snippet?.dataset.commandValue;
	const selected_option = selected_value
		? snippet?.querySelector<HTMLElement>(
				`[data-command-option="${CSS.escape(selected_value)}"]`,
			)
		: undefined;
	const code = selected_option?.querySelector("code");

	return code?.textContent ?? selected_option?.textContent ?? "";
};

const get_copy_text = (button: HTMLButtonElement) =>
	button.dataset.copyKind === "heading-link"
		? get_heading_link_text(button)
		: button.dataset.copyKind === "command"
			? get_command_text(button)
			: get_code_text(button);

const get_copy_kind = (button: HTMLButtonElement) => {
	const copy_kind = button.dataset.copyKind;

	if (copy_kind === "heading-link" || copy_kind === "command") {
		return copy_kind;
	}

	return "snippet";
};

const write_clipboard_text_with_textarea = (text: string, fallback_error?: unknown) =>
	Effect.gen(function* () {
		const copied = yield* Effect.acquireUseRelease(
			Effect.sync(() => {
				const textarea = document.createElement("textarea");
				textarea.value = text;
				textarea.setAttribute("readonly", "");
				textarea.style.position = "fixed";
				textarea.style.inset = "0 auto auto -9999px";

				document.body.append(textarea);
				return textarea;
			}),
			(textarea) =>
				Effect.sync(() => {
					textarea.select();
					return document.execCommand("copy");
				}),
			(textarea) =>
				Effect.sync(() => {
					textarea.remove();
				}),
		);

		if (!copied) {
			return yield* Effect.fail(
				new ClipboardWriteError({
					cause: fallback_error,
					message: "Failed to copy text.",
				}),
			);
		}
	});

const write_clipboard_text_with_api = (text: string) =>
	Effect.tryPromise({
		try: () => navigator.clipboard.writeText(text),
		catch: (error) =>
			new ClipboardWriteError({
				cause: error,
				message: "Failed to copy text.",
			}),
	}).pipe(
		Effect.timeout(`${clipboard_write_timeout_ms} millis`),
		Effect.mapError(
			(error) =>
				new ClipboardWriteError({
					cause: error,
					message: "Failed to copy text.",
				}),
		),
	);

const write_clipboard_text = (text: string) => {
	if (!navigator.clipboard?.writeText) {
		return write_clipboard_text_with_textarea(text);
	}

	return write_clipboard_text_with_api(text).pipe(
		Effect.catchIf(
			() => true,
			(error) => write_clipboard_text_with_textarea(text, error),
		),
	);
};

const position_feedback = (button: HTMLButtonElement, feedback: HTMLElement) => {
	const rect = button.getBoundingClientRect();
	const x = rect.left + rect.width / 2 - feedback.offsetWidth / 2;
	const y = rect.top - feedback.offsetHeight - 4;

	feedback.style.left = `${x}px`;
	feedback.style.top = `${y}px`;
};

const stop_reposition_feedback = (state: CopyButtonState) => {
	state.reposition_cleanup?.();
	state.reposition_cleanup = undefined;

	if (state.position_frame) {
		cancelAnimationFrame(state.position_frame);
		state.position_frame = undefined;
	}
};

const schedule_feedback_position = (button: HTMLButtonElement, state: CopyButtonState) => {
	if (state.position_frame) {
		return;
	}

	state.position_frame = requestAnimationFrame(() => {
		state.position_frame = undefined;

		if (!button.isConnected || button.dataset.copyState !== "success") {
			stop_reposition_feedback(state);
			return;
		}

		if (state.feedback?.isConnected) {
			position_feedback(button, state.feedback);
		}
	});
};

const start_reposition_feedback = (button: HTMLButtonElement, state: CopyButtonState) => {
	if (state.reposition_cleanup) {
		return;
	}

	const schedule = () => schedule_feedback_position(button, state);

	const visual_viewport = document.defaultView?.visualViewport;

	globalThis.addEventListener("scroll", schedule, true);
	globalThis.addEventListener("resize", schedule);
	visual_viewport?.addEventListener("scroll", schedule);
	visual_viewport?.addEventListener("resize", schedule);

	state.reposition_cleanup = () => {
		globalThis.removeEventListener("scroll", schedule, true);
		globalThis.removeEventListener("resize", schedule);
		visual_viewport?.removeEventListener("scroll", schedule);
		visual_viewport?.removeEventListener("resize", schedule);
	};
};

const set_copy_state = (button: HTMLButtonElement, state: string) => {
	const copy_state = get_copy_state(button);
	const feedback = get_feedback(button, copy_state);
	const is_success = state === "success";
	const idle_label = button.dataset.copyLabel ?? "Copy";
	const copied_label = button.dataset.copiedLabel ?? "Copied";

	button.dataset.copyState = state;
	button.setAttribute("aria-label", is_success ? copied_label : idle_label);

	if (!feedback) {
		return;
	}

	if (is_success) {
		position_feedback(button, feedback);
		start_reposition_feedback(button, copy_state);

		if (feedback.dataset.state === "open") {
			return;
		}

		feedback.dataset.state = "closed";
		void feedback.offsetWidth;
	} else {
		stop_reposition_feedback(copy_state);
	}

	feedback.dataset.state = is_success ? "open" : "closed";
};

const schedule_success_reset = (button: HTMLButtonElement, state: CopyButtonState) => {
	state.reset_fiber?.interruptUnsafe();
	state.reset_fiber = Effect.runFork(
		Effect.sleep(`${copied_hold_ms} millis`).pipe(
			Effect.andThen(
				Effect.sync(() => {
					set_copy_state(button, "idle");
					state.reset_fiber = undefined;
				}),
			),
		),
	);
};

const keep_success_visible = (button: HTMLButtonElement, state: CopyButtonState) => {
	set_copy_state(button, "success");
	schedule_success_reset(button, state);
};

const run_copy = (button: HTMLButtonElement, state: CopyButtonState) =>
	Effect.gen(function* () {
		const text = get_copy_text(button);

		if (!text) {
			return;
		}

		yield* write_clipboard_text(text);
		yield* Effect.sync(() => {
			capture_event("code_copied", {
				copy_kind: get_copy_kind(button),
				page_path: get_page_path(),
			});
			play("release");
			keep_success_visible(button, state);
		});
	});

const dequeue_copy = (button: HTMLButtonElement, state: CopyButtonState) => {
	if (state.copy_promise || !state.queued) {
		return;
	}

	state.queued = false;
	state.copy_promise = Effect.runPromise(
		run_copy(button, state).pipe(
			Effect.catchIf(
				() => true,
				(error) => Effect.logWarning("Failed to copy text.", error),
			),
			Effect.ensuring(
				Effect.sync(() => {
					state.copy_promise = undefined;
					dequeue_copy(button, state);
				}),
			),
		),
	);
};

const handle_click = (event: MouseEvent) => {
	const target = event.target;

	if (!(target instanceof Element)) {
		return;
	}

	const button = target.closest<HTMLButtonElement>(copy_button_selector);

	if (!button) {
		return;
	}

	const state = get_copy_state(button);
	state.queued = true;

	if (button.dataset.copyState === "success") {
		schedule_success_reset(button, state);
	}

	dequeue_copy(button, state);
};

const setup_copy_buttons = () => {
	document.addEventListener("click", handle_click);

	return () => {
		document.removeEventListener("click", handle_click);

		for (const button of known_buttons) {
			const state = states.get(button);

			if (!state) {
				continue;
			}

			state.reset_fiber?.interruptUnsafe();
			stop_reposition_feedback(state);
			state.feedback?.remove();
		}

		known_buttons.clear();
	};
};

/** Handles documentation copy buttons for the lifetime of the client runtime. */
export const CopyButtonLive = Layer.effectDiscard(
	Effect.acquireRelease(Effect.sync(setup_copy_buttons), (cleanup) => Effect.sync(cleanup)),
);
