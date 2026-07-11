<script lang="ts">
	import { tick, type Snippet } from "svelte";
	import { fromStore } from "svelte/store";
	import { set_command_picker_context } from "$lib/components/markdown/command-picker/context";
	import { get_command_picker_selection } from "$lib/components/markdown/command-picker/selection";
	import type { CommandPickerContext, CommandPickerOption } from "$lib/components/markdown/command-picker/context";
	import Selector from "@tabler/icons-svelte/icons/selector";
	import FileIcon from "$lib/components/markdown/file-icon.sv";
	import CopyButton from "$lib/components/markdown/copy-button.sv";

	type Props = {
		children?: Snippet;
		default_value?: string;
		id?: string;
		options?: CommandPickerOption[];
		select_label?: string;
		storage_key?: string;
	};

	type CommandPickerContentSide = "bottom" | "top";

	const content_gap = 8;
	const content_viewport_margin = 12;
	const generated_id = $props.id();
	let {
		children,
		default_value = "",
		id = generated_id,
		options = [],
		select_label = "Select command variant",
		storage_key,
	}: Props = $props();

	let open = $state(false);
	let content: HTMLElement | null = $state(null);
	let content_left: number | undefined = $state();
	let content_max_height: number | undefined = $state();
	let content_ready = $state(false);
	let content_side = $state<CommandPickerContentSide>("bottom");
	let content_top: number | undefined = $state();
	let root: HTMLElement | null = $state(null);
	let trigger: HTMLButtonElement | null = $state(null);
	let hover_highlight_animated = $state(false);
	let hover_highlight_height = $state(0);
	let hover_highlight_top = $state(0);
	let hover_highlight_visible = $state(false);
	let selected_value_override: string | undefined = $state();
	const content_id = $derived(`${id}-select`);
	const selection = $derived(
		storage_key ? get_command_picker_selection(storage_key) : undefined,
	);
	const selected_store = $derived(selection ? fromStore(selection) : undefined);

	const get_default_selected_value = (
		default_value: string,
		options: CommandPickerOption[],
	) => {
		if (default_value && options.some((option) => option.value === default_value)) {
			return default_value;
		}

		return options[0]?.value ?? "";
	};

	const has_option = (value: string | undefined): value is string =>
		Boolean(value && options.some((option) => option.value === value));

	const content_style = $derived.by(() => {
		const declarations: string[] = [];

		if (content_left !== undefined) {
			declarations.push(`--docs-command-content-left: ${content_left}px;`);
		}

		if (content_top !== undefined) {
			declarations.push(`--docs-command-content-top: ${content_top}px;`);
		}

		if (content_max_height !== undefined) {
			declarations.push(`--docs-command-content-max-height: ${content_max_height}px;`);
		}

		return declarations.length ? declarations.join(" ") : undefined;
	});

	const selected_value = $derived.by(() => {
		const stored_value = selected_store?.current;

		if (has_option(stored_value)) {
			return stored_value;
		}

		if (has_option(selected_value_override)) {
			return selected_value_override;
		}

		return get_default_selected_value(default_value, options);
	});

	const command_picker: CommandPickerContext = {
		get_selected_value: () => selected_value,
	};

	set_command_picker_context(command_picker);

	const clear_hover_highlight = () => {
		hover_highlight_animated = false;
		hover_highlight_visible = false;
	};

	const wait_for_animation_frame = () =>
		new Promise<void>((resolve) => {
			requestAnimationFrame(() => resolve());
		});

	const portal_to_body = (node: HTMLElement) => {
		document.body.append(node);

		return {
			destroy: () => {
				node.remove();
			},
		};
	};

	const update_content_placement = async () => {
		if (!open) {
			return;
		}

		await tick();

		if (!open || !trigger || !content) {
			return;
		}

		const trigger_rect = trigger.getBoundingClientRect();
		const content_height = content.scrollHeight;
		const content_width = content.offsetWidth;
		const space_below =
			window.innerHeight - trigger_rect.bottom - content_gap - content_viewport_margin;
		const space_above = trigger_rect.top - content_gap - content_viewport_margin;
		const should_place_above =
			space_below < content_height && space_above > space_below;
		const available_space = should_place_above ? space_above : space_below;
		const rendered_content_height = Math.max(
			0,
			Math.min(content_height, available_space),
		);
		const unclamped_left = trigger_rect.right - content_width;
		const max_left = window.innerWidth - content_viewport_margin - content_width;

		content_side = should_place_above ? "top" : "bottom";
		content_left = Math.max(
			content_viewport_margin,
			Math.min(unclamped_left, max_left),
		);
		content_top = should_place_above
			? trigger_rect.top - content_gap - rendered_content_height
			: trigger_rect.bottom + content_gap;
		content_max_height = rendered_content_height;
	};

	const close_content = () => {
		open = false;
		content_left = undefined;
		content_ready = false;
		content_max_height = undefined;
		content_top = undefined;
		clear_hover_highlight();
	};

	const open_content = async () => {
		open = true;
		content_ready = false;

		await update_content_placement();
		await wait_for_animation_frame();

		if (open) {
			content_ready = true;
		}
	};

	const toggle_content = () => {
		if (open) {
			close_content();

			return;
		}

		void open_content();
	};

	const select_option = (value: string) => {
		if (!has_option(value)) {
			return;
		}

		if (selection) {
			selection.select(value);
		} else {
			selected_value_override = value;
		}

		close_content();
	};

	const move_hover_highlight = (element: HTMLElement) => {
		hover_highlight_animated = hover_highlight_visible;
		hover_highlight_height = element.offsetHeight;
		hover_highlight_top = element.offsetTop;
		hover_highlight_visible = true;
	};

	const show_hover_highlight = (event: Event) => {
		if (event.currentTarget instanceof HTMLElement) {
			move_hover_highlight(event.currentTarget);
		}
	};

	const handle_viewport_focusout = (event: FocusEvent) => {
		if (event.currentTarget instanceof HTMLElement) {
			const next_target = event.relatedTarget;

			if (!(next_target instanceof Node) || !event.currentTarget.contains(next_target)) {
				clear_hover_highlight();
			}
		}
	};

	const handle_document_click = (event: MouseEvent) => {
		if (
			!open ||
			!(event.target instanceof Node) ||
			root?.contains(event.target) ||
			content?.contains(event.target)
		) {
			return;
		}

		close_content();
	};
</script>

<svelte:document onclick={handle_document_click} />
<svelte:window onresize={update_content_placement} onscroll={update_content_placement} />

<div
	bind:this={root}
	class="docs-command-snippet not-prose"
	data-command-snippet
	data-open={open}
	id={id}
	data-command-value={selected_value}
>
	<div class="docs-command-snippet-body">
		<div class="docs-command-snippet-code">
			{@render children?.()}
		</div>
		<CopyButton
			class="docs-command-snippet-copy"
			copy_kind="command"
			label="Copy command"
		/>
		<div class="docs-command-snippet-select" data-command-select>
			<button
				bind:this={trigger}
				class="docs-command-snippet-trigger"
				type="button"
				data-slot="select-trigger"
				aria-haspopup="listbox"
				aria-expanded={open}
				aria-controls={content_id}
				aria-label={select_label}
				data-command-trigger
				onclick={toggle_content}
			>
				{#each options as option (option.value)}
					<span
						class="docs-command-snippet-selected-option"
						hidden={option.value !== selected_value}
						data-command-selected-option={option.value}
					>
						<FileIcon name={option.icon ?? option.value} />
						<span>{option.label}</span>
					</span>
				{/each}
				<Selector class="docs-command-snippet-selector-icon" />
			</button>
			<div
				use:portal_to_body
				bind:this={content}
				class="docs-command-snippet-content"
				id={content_id}
				data-slot="select-content"
				role="listbox"
				tabindex="-1"
				data-command-content
				data-ready={content_ready}
				data-side={content_side}
				hidden={!open}
				style={content_style}
				onpointerleave={clear_hover_highlight}
				onfocusout={handle_viewport_focusout}
			>
				<div
					class="docs-command-snippet-viewport"
					data-slot="select-viewport"
				>
					<span
						class="docs-command-snippet-hover-highlight"
						data-active={hover_highlight_visible}
						data-animate={hover_highlight_animated}
						aria-hidden="true"
						style={`--docs-command-hover-y: ${hover_highlight_top}px; --docs-command-hover-height: ${hover_highlight_height}px;`}
					></span>
					{#each options as option (option.value)}
						<button
							class="docs-command-snippet-item"
							type="button"
							role="option"
							aria-selected={option.value === selected_value}
							data-command-item={option.value}
							onpointerenter={show_hover_highlight}
							onfocus={show_hover_highlight}
							onclick={() => select_option(option.value)}
						>
							<FileIcon name={option.icon ?? option.value} />
							<span>{option.label}</span>
							<span
								class="docs-command-snippet-select-check-wrap"
								hidden={option.value !== selected_value}
							>
								<svg
									class="docs-command-snippet-select-check"
									viewBox="0 0 24 24"
									aria-hidden="true"
									focusable="false"
								>
									<path
										d="M5 12l5 5L20 7"
										fill="none"
										stroke="currentColor"
										stroke-linecap="round"
										stroke-linejoin="round"
										stroke-width="3"
									/>
								</svg>
							</span>
						</button>
					{/each}
				</div>
			</div>
		</div>
	</div>
</div>
