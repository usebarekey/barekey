import { Effect, Layer } from "effect";

type DiffRect = {
	height: number;
	right: number;
	top: number;
	width: number;
};

type DiffGroup = {
	kind: string;
	lines: HTMLElement[];
};

type StepRadius = {
	x: number;
	y: number;
};

const code_selector = ".docs-code-snippet-body code";
const diff_line_selector = ".line[data-diff]";
const card_class = "docs-code-diff-card";
const diff_card_properties = [
	"--shiki-diff-light",
	"--diff-fill-from-opacity",
	"--diff-fill-to-opacity",
	"--diff-card-drop-opacity",
	"--diff-card-ring-opacity",
	"--diff-card-shadow-opacity",
	"--diff-card-top-opacity",
] as const;
const max_svg_precision = 100;
const maximum_lip_delta_ratio = 1 / 3;
const minimum_delta = 0.5;
const svg_namespace = "http://www.w3.org/2000/svg";

const observed_code_blocks = new WeakSet<HTMLElement>();
let render_frame: number | undefined;
let resize_observer: ResizeObserver | undefined;
let gradient_id_index = 0;

const round_svg_number = (value: number) =>
	Math.round(value * max_svg_precision) / max_svg_precision;

const render_svg_number = (value: number) => String(round_svg_number(value));

const parse_css_length = (
	value: string,
	element_style: CSSStyleDeclaration,
	root_style: CSSStyleDeclaration,
) => {
	const normalized = value.trim();
	const amount = Number.parseFloat(normalized);

	if (!Number.isFinite(amount)) {
		return undefined;
	}

	if (normalized.endsWith("rem")) {
		return amount * Number.parseFloat(root_style.fontSize);
	}

	if (normalized.endsWith("em")) {
		return amount * Number.parseFloat(element_style.fontSize);
	}

	return amount;
};

const get_css_length_property = (element: HTMLElement, name: string, fallback: number) => {
	const element_style = getComputedStyle(element);
	const root_style = getComputedStyle(document.documentElement);
	const value = parse_css_length(element_style.getPropertyValue(name), element_style, root_style);

	return value ?? fallback;
};

const get_diff_groups = (code: HTMLElement) => {
	const groups: DiffGroup[] = [];

	for (const line of code.querySelectorAll<HTMLElement>(diff_line_selector)) {
		const kind = line.dataset.diff;
		const group = groups.at(-1);
		const previous_line = group?.lines.at(-1);
		const is_contiguous = previous_line?.nextElementSibling === line;

		if (kind && group?.kind === kind && is_contiguous) {
			group.lines.push(line);
			continue;
		}

		if (kind) {
			groups.push({ kind, lines: [line] });
		}
	}

	return groups;
};

const get_diff_rects = (code: HTMLElement, lines: HTMLElement[]) => {
	const code_rect = code.getBoundingClientRect();
	const line_rects = lines.map((line) => line.getBoundingClientRect());
	const left = Math.min(...line_rects.map((rect) => rect.left));
	const top = Math.min(...line_rects.map((rect) => rect.top));

	return {
		left: left - code_rect.left,
		rects: line_rects.map(
			(rect): DiffRect => ({
				height: rect.height,
				right: rect.right - left,
				top: rect.top - top,
				width: rect.width,
			}),
		),
		top: top - code_rect.top,
	};
};

const get_outer_radius = (radius: number, width: number, height: number) =>
	Math.max(0, Math.min(radius, width / 2, height / 2));

const get_rect_radius = (radius: number, rect: DiffRect) =>
	Math.max(0, Math.min(radius, rect.width / 2, rect.height / 2));

const get_step_radius = (radius: number, rect: DiffRect): StepRadius => {
	const rect_radius = get_rect_radius(radius, rect);

	return {
		x: rect_radius,
		y: rect_radius,
	};
};

const get_constrained_step_radii = (
	outer_radius: StepRadius,
	lip_radius: StepRadius,
	delta: number,
) => {
	if (outer_radius.x + lip_radius.x <= delta) {
		return { lip_radius, outer_radius };
	}

	const preferred_lip_radius = Math.min(lip_radius.x, delta * maximum_lip_delta_ratio);
	const constrained_outer_radius = Math.min(outer_radius.x, delta - preferred_lip_radius);
	const constrained_lip_radius = Math.min(lip_radius.x, delta - constrained_outer_radius);

	/** Only the horizontal axis has to fit inside the width step. */
	return {
		lip_radius: {
			...lip_radius,
			x: constrained_lip_radius,
		},
		outer_radius: {
			...outer_radius,
			x: constrained_outer_radius,
		},
	};
};

const get_step_radii = (
	radius: number,
	lip_radius: number,
	delta: number,
	rect: DiffRect,
	next_rect: DiffRect,
) => {
	const is_next_rect_longer = next_rect.right > rect.right;
	const outer_radius = get_step_radius(radius, is_next_rect_longer ? next_rect : rect);
	const inner_lip_radius = get_step_radius(lip_radius, is_next_rect_longer ? rect : next_rect);
	const constrained_radii = get_constrained_step_radii(outer_radius, inner_lip_radius, delta);

	if (is_next_rect_longer) {
		return {
			next_rect_radius: constrained_radii.outer_radius,
			rect_radius: constrained_radii.lip_radius,
		};
	}

	return {
		next_rect_radius: constrained_radii.lip_radius,
		rect_radius: constrained_radii.outer_radius,
	};
};

export const create_diff_card_path = (rects: DiffRect[], radius: number, lip_radius = radius) => {
	const commands: string[] = [];
	const first_rect = rects[0];
	const last_rect = rects.at(-1);

	if (!first_rect || !last_rect) {
		return "";
	}

	const group_height = last_rect.top + last_rect.height;
	const top_left_radius = get_outer_radius(radius, first_rect.right, group_height);
	const top_right_radius = get_outer_radius(radius, first_rect.right, first_rect.height);
	const bottom_right_radius = get_outer_radius(radius, last_rect.right, last_rect.height);
	const bottom_left_radius = get_outer_radius(radius, last_rect.right, group_height);

	const move_to = (x: number, y: number) => {
		commands.push(`M ${render_svg_number(x)} ${render_svg_number(y)}`);
	};
	const line_to = (x: number, y: number) => {
		commands.push(`L ${render_svg_number(x)} ${render_svg_number(y)}`);
	};
	const quad_to = (control_x: number, control_y: number, x: number, y: number) => {
		commands.push(
			`Q ${render_svg_number(control_x)} ${render_svg_number(control_y)} ${render_svg_number(
				x,
			)} ${render_svg_number(y)}`,
		);
	};

	move_to(top_left_radius, 0);
	line_to(first_rect.right - top_right_radius, 0);
	quad_to(first_rect.right, 0, first_rect.right, top_right_radius);

	for (const [index, rect] of rects.entries()) {
		const next_rect = rects[index + 1];
		const transition_y = rect.top + rect.height;

		if (!next_rect) {
			line_to(rect.right, group_height - bottom_right_radius);
			quad_to(rect.right, group_height, rect.right - bottom_right_radius, group_height);
			continue;
		}

		const delta = Math.abs(next_rect.right - rect.right);

		if (delta <= minimum_delta) {
			line_to(rect.right, transition_y);
			continue;
		}

		const { next_rect_radius, rect_radius } = get_step_radii(
			radius,
			lip_radius,
			delta,
			rect,
			next_rect,
		);

		if (next_rect.right > rect.right) {
			line_to(rect.right, transition_y - rect_radius.y);
			quad_to(rect.right, transition_y, rect.right + rect_radius.x, transition_y);
			line_to(next_rect.right - next_rect_radius.x, transition_y);
			quad_to(
				next_rect.right,
				transition_y,
				next_rect.right,
				transition_y + next_rect_radius.y,
			);
			continue;
		}

		line_to(rect.right, transition_y - rect_radius.y);
		quad_to(rect.right, transition_y, rect.right - rect_radius.x, transition_y);
		line_to(next_rect.right + next_rect_radius.x, transition_y);
		quad_to(next_rect.right, transition_y, next_rect.right, transition_y + next_rect_radius.y);
	}

	line_to(bottom_left_radius, group_height);
	quad_to(0, group_height, 0, group_height - bottom_left_radius);
	line_to(0, top_left_radius);
	quad_to(0, 0, top_left_radius, 0);
	commands.push("Z");

	return commands.join(" ");
};

const copy_diff_card_properties = (source: CSSStyleDeclaration, target: SVGSVGElement) => {
	for (const property of diff_card_properties) {
		target.style.setProperty(property, source.getPropertyValue(property));
	}
};

const create_diff_card_gradient = (id: string) => {
	const defs = document.createElementNS(svg_namespace, "defs");
	const gradient = document.createElementNS(svg_namespace, "linearGradient");
	const start = document.createElementNS(svg_namespace, "stop");
	const end = document.createElementNS(svg_namespace, "stop");

	gradient.id = id;
	gradient.setAttribute("x1", "0");
	gradient.setAttribute("x2", "0");
	gradient.setAttribute("y1", "0");
	gradient.setAttribute("y2", "1");

	start.classList.add("docs-code-diff-card-gradient-start");
	start.setAttribute("offset", "0%");
	end.classList.add("docs-code-diff-card-gradient-end");
	end.setAttribute("offset", "100%");

	gradient.append(start, end);
	defs.append(gradient);

	return defs;
};

const create_diff_card_svg = ({
	height,
	left,
	path,
	properties,
	top,
	width,
}: {
	height: number;
	left: number;
	path: string;
	properties: CSSStyleDeclaration;
	top: number;
	width: number;
}) => {
	const svg = document.createElementNS(svg_namespace, "svg");
	const path_element = document.createElementNS(svg_namespace, "path");
	const gradient_id = `docs-code-diff-card-gradient-${gradient_id_index++}`;

	svg.classList.add(card_class);
	svg.setAttribute("aria-hidden", "true");
	svg.setAttribute("viewBox", `0 0 ${render_svg_number(width)} ${render_svg_number(height)}`);
	svg.style.height = `${height}px`;
	svg.style.left = `${left}px`;
	svg.style.top = `${top}px`;
	svg.style.width = `${width}px`;
	copy_diff_card_properties(properties, svg);

	path_element.setAttribute("d", path);
	path_element.setAttribute("fill", `url(#${gradient_id})`);
	path_element.setAttribute("pathLength", "1");
	path_element.setAttribute("vector-effect", "non-scaling-stroke");

	svg.append(create_diff_card_gradient(gradient_id), path_element);

	return svg;
};

const remove_diff_cards = (code: HTMLElement) => {
	for (const card of code.querySelectorAll(`:scope > .${card_class}`)) {
		card.remove();
	}
};

const is_diff_card_node = (node: Node) =>
	node instanceof Element && node.classList.contains(card_class);

const should_render_for_mutations = (records: MutationRecord[]) =>
	records.some((record) =>
		[...record.addedNodes, ...record.removedNodes].some((node) => !is_diff_card_node(node)),
	);

const create_code_diff_cards = (code: HTMLElement) => {
	const cards: SVGSVGElement[] = [];

	for (const group of get_diff_groups(code)) {
		const first_line = group.lines[0];

		if (!first_line) {
			continue;
		}

		const { left, rects, top } = get_diff_rects(code, group.lines);
		const last_rect = rects.at(-1);

		if (!last_rect) {
			continue;
		}

		const width = Math.max(...rects.map((rect) => rect.right));
		const height = last_rect.top + last_rect.height;
		const line_style = getComputedStyle(first_line);
		const radius = get_css_length_property(first_line, "--diff-radius", 14);
		const lip_radius = get_css_length_property(first_line, "--diff-lip-radius", radius);
		const path = create_diff_card_path(rects, radius, lip_radius);

		if (!path || width <= 0 || height <= 0) {
			continue;
		}

		cards.push(
			create_diff_card_svg({ height, left, path, properties: line_style, top, width }),
		);
	}

	return cards;
};

const observe_code_blocks = () => {
	for (const code of document.querySelectorAll<HTMLElement>(code_selector)) {
		if (observed_code_blocks.has(code)) {
			continue;
		}

		observed_code_blocks.add(code);
		resize_observer?.observe(code);
	}
};

const render_diff_cards = () => {
	observe_code_blocks();
	const renders = Array.from(document.querySelectorAll<HTMLElement>(code_selector), (code) => ({
		cards: create_code_diff_cards(code),
		code,
	}));

	for (const { cards, code } of renders) {
		remove_diff_cards(code);
		code.append(...cards);
	}
};

const schedule_diff_card_render = () => {
	if (render_frame !== undefined) {
		return;
	}

	render_frame = requestAnimationFrame(() => {
		render_frame = undefined;
		render_diff_cards();
	});
};

const setup_diff_code_cards = () => {
	resize_observer = new ResizeObserver(schedule_diff_card_render);
	observe_code_blocks();
	schedule_diff_card_render();

	const mutation_observer = new MutationObserver((records) => {
		if (!should_render_for_mutations(records)) {
			return;
		}

		observe_code_blocks();
		schedule_diff_card_render();
	});

	mutation_observer.observe(document.documentElement, {
		childList: true,
		subtree: true,
	});

	const visual_viewport = document.defaultView?.visualViewport;

	globalThis.addEventListener("resize", schedule_diff_card_render);
	visual_viewport?.addEventListener("resize", schedule_diff_card_render);
	void document.fonts?.ready.then(schedule_diff_card_render);

	return () => {
		mutation_observer.disconnect();
		resize_observer?.disconnect();
		resize_observer = undefined;
		globalThis.removeEventListener("resize", schedule_diff_card_render);
		visual_viewport?.removeEventListener("resize", schedule_diff_card_render);

		if (render_frame !== undefined) {
			cancelAnimationFrame(render_frame);
			render_frame = undefined;
		}

		for (const code of document.querySelectorAll<HTMLElement>(code_selector)) {
			remove_diff_cards(code);
		}
	};
};

/** Renders code diff cards for the lifetime of the client runtime. */
export const DiffCodeCardLive = Layer.effectDiscard(
	Effect.acquireRelease(Effect.sync(setup_diff_code_cards), (cleanup) => Effect.sync(cleanup)),
);
