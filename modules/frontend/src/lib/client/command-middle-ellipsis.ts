import type { Action } from "svelte/action";

type MeasureText = (value: string) => number;

const ellipsis_separator = " … ";

const get_preferred_prefix_length = (command: string) => {
	const matches = Array.from(command.matchAll(/\S+/g));
	const second_token = matches[1] ?? matches[0];

	return second_token ? (second_token.index ?? 0) + second_token[0].length : 0;
};

const get_preferred_suffix_length = (command: string) => {
	const final_token = /\S+$/.exec(command);

	return final_token ? command.length - (final_token.index ?? command.length) : 0;
};

const is_word_boundary = (value: string, index: number) =>
	index <= 0 ||
	index >= value.length ||
	/\s/.test(value[index - 1] ?? "") ||
	/\s/.test(value[index] ?? "");

export const get_middle_ellipsis_text = (
	command: string,
	available_width: number,
	measure_text: MeasureText,
) => {
	const normalized_command = command.trim();

	if (!normalized_command || available_width <= 0) {
		return "";
	}

	if (measure_text(normalized_command) <= available_width) {
		return normalized_command;
	}

	const preferred_prefix_length = get_preferred_prefix_length(normalized_command);
	const preferred_suffix_length = get_preferred_suffix_length(normalized_command);
	let best_text = measure_text("…") <= available_width ? "…" : "";
	let best_score = Number.NEGATIVE_INFINITY;

	for (let prefix_length = 1; prefix_length < normalized_command.length; prefix_length += 1) {
		for (
			let suffix_length = 1;
			suffix_length < normalized_command.length - prefix_length;
			suffix_length += 1
		) {
			const prefix = normalized_command.slice(0, prefix_length).trimEnd();
			const suffix = normalized_command.slice(-suffix_length).trimStart();

			if (!prefix || !suffix) {
				continue;
			}

			if (prefix_length > preferred_prefix_length) {
				const following_character = normalized_command[prefix_length] ?? "";

				if (following_character && !/[\s\-_/.:@]/.test(following_character)) {
					continue;
				}
			}

			if (suffix_length < preferred_suffix_length) {
				const suffix_start = normalized_command.length - suffix_length;
				const preceding_character = normalized_command[suffix_start - 1] ?? "";

				if (preceding_character && !/[\s\-_/.:@]/.test(preceding_character)) {
					continue;
				}
			}

			const candidate = `${prefix}${ellipsis_separator}${suffix}`;

			if (measure_text(candidate) > available_width) {
				continue;
			}

			const preserves_prefix = prefix_length >= preferred_prefix_length;
			const preserves_suffix = suffix_length >= preferred_suffix_length;
			const boundary_score =
				(is_word_boundary(normalized_command, prefix_length) ? 2 : 0) +
				(is_word_boundary(normalized_command, normalized_command.length - suffix_length)
					? 2
					: 0);
			const score =
				(preserves_prefix ? 2_000_000 : 0) +
				(preserves_suffix ? 1_000_000 : 0) +
				(prefix_length + suffix_length) * 10 +
				Math.min(suffix_length, preferred_suffix_length) * 3 +
				boundary_score;

			if (score > best_score) {
				best_score = score;
				best_text = candidate;
			}
		}
	}

	return best_text;
};

export const middle_ellipsis_command: Action<HTMLElement, string> = (node, initial_command) => {
	let command = initial_command;
	const display = node.querySelector<HTMLElement>("[data-command-middle-display]");
	const source = node.querySelector<HTMLElement>("[data-command-source]");
	const measurement = document.createElement("span");

	measurement.className = "docs-command-snippet-measurement";
	measurement.setAttribute("aria-hidden", "true");
	node.append(measurement);

	const measure_text = (value: string) => {
		measurement.textContent = value;

		return measurement.getBoundingClientRect().width;
	};

	const render_highlighted_command = (rendered_command: string) => {
		if (!display || !source) return;

		const separator_index = rendered_command.indexOf(ellipsis_separator);

		if (separator_index < 0) {
			display.replaceChildren();
			return;
		}

		const prefix_length = separator_index;
		const suffix_length = rendered_command.length - separator_index - ellipsis_separator.length;
		const suffix_start = command.trim().length - suffix_length;
		const highlighted = source.cloneNode(true) as HTMLElement;
		const highlighted_code = highlighted.querySelector("code") ?? highlighted;
		const walker = document.createTreeWalker(highlighted_code, NodeFilter.SHOW_TEXT);
		const text_nodes: Text[] = [];
		let text_node: Text | null;

		while ((text_node = walker.nextNode() as Text | null)) text_nodes.push(text_node);

		let offset = 0;
		let inserted_ellipsis = false;

		for (const current_node of text_nodes) {
			const value = current_node.data;
			const start = offset;
			const end = start + value.length;
			const prefix = value.slice(
				0,
				Math.max(0, Math.min(value.length, prefix_length - start)),
			);
			const suffix = value.slice(Math.max(0, Math.min(value.length, suffix_start - start)));

			if (!inserted_ellipsis && end > suffix_start) {
				current_node.data = `${prefix}${ellipsis_separator}${suffix}`;
				inserted_ellipsis = true;
			} else {
				current_node.data = `${prefix}${suffix}`;
			}

			offset = end;
		}

		display.replaceChildren(...Array.from(highlighted.childNodes));
	};

	const update_display = () => {
		if (!display || node.clientWidth <= 0) {
			return;
		}

		const rendered_command = get_middle_ellipsis_text(command, node.clientWidth, measure_text);
		const truncated = rendered_command !== command.trim();

		if (truncated) render_highlighted_command(rendered_command);
		else display.replaceChildren();
		node.dataset.commandTruncated = truncated ? "true" : "false";
	};

	const resize_observer = new ResizeObserver(update_display);
	resize_observer.observe(node);
	update_display();

	return {
		update(next_command) {
			command = next_command;
			update_display();
		},
		destroy() {
			resize_observer.disconnect();
			measurement.remove();
		},
	};
};
