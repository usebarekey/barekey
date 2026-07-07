import { Data, Effect } from "effect";
import { escape } from "html-escaper";
import { render } from "svelte/server";
import { FloatingFeedback } from "$lib/components/ui/floating-feedback";
import Check from "@tabler/icons-svelte/icons/check";
import Copy from "@tabler/icons-svelte/icons/copy";

type CopyButtonOptions = {
	attributes?: Record<string, string | undefined>;
	class_name?: string;
	copied_label?: string;
	feedback_text?: string;
	label: string;
};

/**
 * Error raised when a copy button component cannot be server-rendered.
 * @since 0.0.1
 */
export class CopyButtonRenderError extends Data.TaggedError("CopyButtonRenderError")<{
	message: string;
}> {}

const render_copy_icon = () =>
	Effect.runSync(
		Effect.try({
			try: () =>
				render(Copy, {
					props: {
						"aria-hidden": true,
						class: "docs-copy-button-icon docs-copy-button-icon-idle",
						size: 16,
					},
				}).body,
			catch: (error) =>
				new CopyButtonRenderError({
					message: error instanceof Error ? error.message : "Unknown error.",
				}),
		}),
	);

const render_success_icon = () =>
	Effect.runSync(
		Effect.try({
			try: () =>
				render(Check, {
					props: {
						"aria-hidden": true,
						class: "docs-copy-button-icon docs-copy-button-icon-success",
						size: 16,
					},
				}).body,
			catch: (error) =>
				new CopyButtonRenderError({
					message: error instanceof Error ? error.message : "Unknown error.",
				}),
		}),
	);

const render_copy_button_icon = () =>
	`<span class="docs-copy-button-icon-stack" aria-hidden="true"><span class="docs-copy-button-icon-layer">${render_copy_icon()}</span><span class="docs-copy-button-icon-layer">${render_success_icon()}</span></span>`;

const render_copy_feedback = (text: string) =>
	Effect.runSync(
		Effect.try({
			try: () =>
				render(FloatingFeedback, {
					props: {
						text,
					},
				}).body,
			catch: (error) =>
				new CopyButtonRenderError({
					message: error instanceof Error ? error.message : "Unknown error.",
				}),
		}),
	);

const render_attributes = (attributes: Record<string, string | undefined>) =>
	Object.entries(attributes)
		.flatMap(([key, value]) => (value === undefined ? [] : `${key}="${escape(value)}"`))
		.join(" ");

/**
 * Renders the shared docs copy button used by code snippets and heading links.
 * @param options Copy button labels, classes, and data attributes.
 * @returns Server-rendered copy button HTML.
 * @since 0.0.1
 */
export const render_copy_button = ({
	attributes = {},
	class_name,
	copied_label = "Copied",
	feedback_text = "Copied to clipboard.",
	label,
}: CopyButtonOptions) => {
	const classes = ["docs-copy-button", class_name].filter(Boolean).join(" ");
	const extra_attributes = render_attributes(attributes);

	return `<button class="${escape(classes)}" type="button" aria-label="${escape(
		label,
	)}" data-copy-label="${escape(label)}" data-copied-label="${escape(
		copied_label,
	)}" data-copy-state="idle"${
		extra_attributes ? ` ${extra_attributes}` : ""
	}>${render_copy_button_icon()}${render_copy_feedback(feedback_text)}</button>`;
};
