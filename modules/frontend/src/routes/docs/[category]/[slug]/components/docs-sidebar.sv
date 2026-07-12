<script lang="ts">
	import { capture_event, get_page_path } from "$lib/client/analytics";
	import { get_sidebar_stagger_delays } from "$lib/client/sidebar-motion";
	import type { DocsContentMeta, DocsNavEntry, DocsNavEntryGroup, DocsNavGroup } from "$lib/data/docs-content-meta";
	import { tick } from "svelte";

	import barekey_logo from "$lib/assets/barekey/logo-40.png";
	import DocsSidebarEntryGroup from "./docs-sidebar-entry-group.sv";

	import * as Sidebar from "$lib/components/ui/sidebar";

	type DocsRoute = {
		category: string;
		slug: string;
	};

	type DocsNavRenderEntry = {
		child_index: number;
		nav_entry: DocsNavEntry;
		slug: string;
	};

	type DocsNavRenderGroup = {
		category: string;
		child_index: number;
		nav_group: DocsNavGroup;
		sections: DocsNavRenderSection[];
	};

	type DocsNavRenderEntryGroup = {
		category?: string;
		category_child_index: number | null;
		collapsible: boolean;
		entries: DocsNavRenderEntry[];
		group_index: number;
		label_child_index: number | null;
		name?: string;
	};

	type DocsNavRenderSection = {
		collapsible: boolean;
		entry_groups: DocsNavRenderEntryGroup[];
		group_index: number;
		label_child_index: number | null;
		name?: string;
	};

	type DocsNavRenderModel = {
		child_count: number;
		groups: DocsNavRenderGroup[];
	};

	type ElementMeasurement = {
		height: number;
		left: number;
		top: number;
		width: number;
	};

	const selected_caret_horizontal_offset_px = 9;
	const sidebar_natural_width_variable = "--docs-sidebar-natural-width";
	const sidebar_state = Sidebar.use_sidebar();

	const fallback_name = (slug: string) =>
		slug
			.split("-")
			.filter(Boolean)
			.map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
			.join(" ");

	const get_docs_href = ({ category, slug }: DocsRoute) => `/docs/${category}/${slug}`;

	const track_docs_nav_click = ({
		category,
		slug,
		doc_title,
	}: {
		category: string;
		slug: string;
		doc_title: string;
	}) => {
		capture_event("docs_nav_clicked", {
			category,
			slug,
			doc_title,
			from_path: get_page_path(),
		});

		if (sidebar_state.is_mobile) {
			sidebar_state.set_open_mobile(false);
		}
	};

	const get_docs_nav_groups = (meta: DocsContentMeta) => Object.entries(meta);

	const get_docs_nav_entry_group_entries = (entry_group: DocsNavEntryGroup) =>
		entry_group.entries.flatMap((entry_group_item) =>
			Object.entries(entry_group_item).filter(
				(entry): entry is [string, DocsNavEntry] => entry[1] !== undefined,
			),
		);

	const get_nav_entry_name = (slug: string, entry: DocsNavEntry) =>
		entry.name ?? fallback_name(slug);

	const get_nav_group_label_gap = (entry_group_index: number) =>
		entry_group_index === 0 ? "none" : "group";

	const get_active_section_href = (
		category: string,
		section: DocsNavRenderSection,
		current_href: string,
	) =>
		section.entry_groups
			.flatMap((entry_group) => entry_group.entries)
			.map(({ slug }) => get_docs_href({ category, slug }))
			.find((href) => href === current_href);

	const get_docs_nav_render_sections = (
		entry_groups: DocsNavRenderEntryGroup[],
	) =>
		entry_groups.reduce<DocsNavRenderSection[]>((sections, entry_group) => {
			const previous_section = sections.at(-1);

			if (!entry_group.name && previous_section?.name) {
				previous_section.entry_groups.push(entry_group);

				return sections;
			}

			return [
				...sections,
				{
					collapsible: entry_group.collapsible,
					entry_groups: [entry_group],
					group_index: entry_group.group_index,
					label_child_index: entry_group.label_child_index,
					name: entry_group.name,
				},
			];
		}, []);

	const get_nav_entry_gap = (
		entry_group_index: number,
		entry_index: number,
		has_group_label: boolean,
	) => {
		if (entry_group_index === 0 && entry_index === 0) {
			return "none";
		}

		if (entry_index === 0) {
			return has_group_label ? "after-group-label" : "group";
		}

		return "item";
	};

	const get_docs_nav_render_model = (
		meta: DocsContentMeta,
	): DocsNavRenderModel => {
		let child_index = 1;

		const groups = get_docs_nav_groups(meta).map(([category, nav_group]) => {
			const group_child_index = child_index;
			child_index += 1;

			const entry_groups = nav_group.entries
				.map((entry_group, group_index) => {
					const entry_pairs = get_docs_nav_entry_group_entries(entry_group);
					const label_child_index =
						entry_group.name && entry_pairs.length > 0 ? child_index : null;

					if (label_child_index !== null) {
						child_index += 1;
					}

					const category_child_index =
						entry_group.category && entry_pairs.length > 0 ? child_index : null;

					if (category_child_index !== null) {
						child_index += 1;
					}

					return {
						category: entry_group.category,
						category_child_index,
						collapsible: entry_group.collapsible ?? false,
						entries: entry_pairs.map(([slug, nav_entry]) => {
							const entry_child_index = child_index;
							child_index += 1;

							return {
								child_index: entry_child_index,
								nav_entry,
								slug,
							};
						}),
						group_index,
						label_child_index,
						name: entry_group.name,
					};
				})
				.filter((entry_group) => entry_group.entries.length > 0);
			const sections = get_docs_nav_render_sections(entry_groups);

			return {
				category,
				child_index: group_child_index,
				nav_group,
				sections,
			};
		});

		return {
			child_count: child_index,
			groups,
		};
	};

	const get_sidebar_child_style = (
		child_index: number,
		child_count: number,
	) => {
		const { enter_ms, exit_ms } = get_sidebar_stagger_delays(child_index, child_count);

		return `--sidebar-child-enter-delay: ${enter_ms}ms; --sidebar-child-exit-delay: ${exit_ms}ms`;
	};

	let {
		content_meta,
		route,
	}: {
		content_meta: DocsContentMeta;
		route: DocsRoute;
	} = $props();

	let nav_surface = $state<HTMLElement | null>(null);
	let sidebar_panel = $state<HTMLElement | null>(null);
	let hovered_element: HTMLElement | null = null;
	let hover_highlight_animated = $state(false);
	let hover_highlight_height = $state(0);
	let hover_highlight_left = $state(0);
	let hover_highlight_top = $state(0);
	let hover_highlight_visible = $state(false);
	let hover_highlight_width = $state(0);
	let selected_caret_animated = $state(false);
	let selected_caret_left = $state(0);
	let selected_caret_line_height = $state(0);
	let selected_caret_top = $state(0);
	let selected_caret_visible = $state(false);
	let sidebar_measurement_frame = 0;
	let sidebar_natural_width = 0;
	const current_href = $derived(get_docs_href(route));
	const docs_nav_render_model = $derived(get_docs_nav_render_model(content_meta));

	const get_required_inline_size = (
		parent: HTMLElement,
		child: HTMLElement,
		end_padding = 0,
	) => {
		const parent_rect = parent.getBoundingClientRect();
		const child_rect = child.getBoundingClientRect();

		return child_rect.left - parent_rect.left + child.scrollWidth + end_padding;
	};

	const get_style_pixel_value = (element: HTMLElement, property: string) => {
		const value = Number.parseFloat(getComputedStyle(element).getPropertyValue(property));

		return Number.isFinite(value) ? value : 0;
	};

	const get_sidebar_natural_width = (sidebar_container: HTMLElement) => {
		const container_end_padding = get_style_pixel_value(sidebar_container, "padding-right");
		const nav_end_padding = nav_surface
			? get_style_pixel_value(nav_surface, "padding-right")
			: 0;
		const nav_text_widths = Array.from(
			nav_surface?.querySelectorAll<HTMLElement>(
				".docs-sidebar-nav-link-text, .docs-sidebar-nav-group-label-text, .docs-sidebar-nav-category-label-text",
			) ?? [],
		)
			.map((text_element) => {
			const text_container = text_element.closest<HTMLElement>(
				".docs-sidebar-nav-link, .docs-sidebar-nav-group-label, .docs-sidebar-nav-category",
			);
			const text_container_end_padding = text_container
				? get_style_pixel_value(text_container, "padding-right")
				: 0;

				return get_required_inline_size(
					sidebar_container,
					text_element,
					text_container_end_padding + nav_end_padding + container_end_padding,
				);
			});

		return Math.ceil(
			Math.max(
				get_required_inline_size(
					sidebar_container,
					sidebar_panel!,
					container_end_padding,
				),
				nav_surface
					? get_required_inline_size(
							sidebar_container,
							nav_surface,
							container_end_padding,
						)
					: 0,
				...nav_text_widths,
			),
		);
	};

	const set_sidebar_natural_width = () => {
		if (!sidebar_panel) {
			return;
		}

		const wrapper = sidebar_panel.closest<HTMLElement>("[data-slot=\"sidebar-wrapper\"]");
		const sidebar_container = sidebar_panel.closest<HTMLElement>(
			"[data-slot=\"sidebar-container\"]",
		);

		if (!wrapper || !sidebar_container) {
			return;
		}

		const natural_width = get_sidebar_natural_width(sidebar_container);

		if (natural_width === sidebar_natural_width) {
			return;
		}

		sidebar_natural_width = natural_width;
		wrapper.style.setProperty(
			sidebar_natural_width_variable,
			`${natural_width}px`,
		);
	};

	const schedule_sidebar_measurement = () => {
		if (typeof requestAnimationFrame === "undefined") {
			set_sidebar_natural_width();
			return;
		}

		cancelAnimationFrame(sidebar_measurement_frame);
		sidebar_measurement_frame = requestAnimationFrame(() => {
			set_sidebar_natural_width();
			update_nav_chrome();
		});
	};

	const get_nav_surface_measurement = (
		element: HTMLElement,
	): ElementMeasurement | undefined => {
		if (
			!nav_surface ||
			element.closest("[aria-hidden=\"true\"], [inert]") ||
			element.getClientRects().length === 0
		) {
			return undefined;
		}

		const surface_rect = nav_surface.getBoundingClientRect();
		const element_rect = element.getBoundingClientRect();

		return {
			height: element_rect.height,
			left: element_rect.left - surface_rect.left + nav_surface.scrollLeft,
			top: element_rect.top - surface_rect.top + nav_surface.scrollTop,
			width: element_rect.width,
		};
	};

	const get_element_line_height = (
		element: HTMLElement,
		fallback_height: number,
	) => {
		const line_height = Number.parseFloat(getComputedStyle(element).lineHeight);

		return Number.isFinite(line_height) ? line_height : fallback_height;
	};

	const clear_hover_highlight = () => {
		hovered_element = null;
		hover_highlight_animated = false;
		hover_highlight_visible = false;
	};

	const move_hover_highlight = (element: HTMLElement) => {
		const measurement = get_nav_surface_measurement(element);

		if (!measurement) {
			return;
		}

		hovered_element = element;
		hover_highlight_animated = hover_highlight_visible;
		hover_highlight_height = measurement.height;
		hover_highlight_left = measurement.left;
		hover_highlight_top = measurement.top;
		hover_highlight_visible = true;
		hover_highlight_width = measurement.width;
	};

	const show_hover_highlight = (event: Event) => {
		if (event.currentTarget instanceof HTMLElement) {
			move_hover_highlight(event.currentTarget);
		}
	};

	const restore_hover_highlight = () => {
		if (typeof document === "undefined" || !nav_surface) {
			return;
		}

		const hovered_target =
			hovered_element?.isConnected &&
			nav_surface.contains(hovered_element) &&
			hovered_element.matches(":hover")
				? hovered_element
				: Array.from(
						nav_surface.querySelectorAll<HTMLElement>(
							".docs-sidebar-nav-link, .docs-sidebar-nav-disclosure",
						),
					).find((node) => node.matches(":hover"));

		if (hovered_target) {
			move_hover_highlight(hovered_target);
			return;
		}

		clear_hover_highlight();
	};

	const update_selected_caret = () => {
		const active_link = nav_surface?.querySelector<HTMLElement>(
			".docs-sidebar-nav-link[data-active=\"true\"]",
		);

		if (!active_link) {
			selected_caret_visible = false;
			return;
		}

		const measurement = get_nav_surface_measurement(active_link);

		if (!measurement) {
			selected_caret_visible = false;
			return;
		}

		const line_height = get_element_line_height(active_link, measurement.height);

		selected_caret_animated = selected_caret_visible;
		selected_caret_left =
			measurement.left - selected_caret_horizontal_offset_px;
		selected_caret_line_height = line_height;
		selected_caret_top =
			measurement.top + Math.max(0, (measurement.height - line_height) / 2);
		selected_caret_visible = true;
	};

	const schedule_selected_caret_update = () => {
		void tick().then(update_selected_caret);
	};

	const update_nav_chrome = () => {
		schedule_selected_caret_update();
		restore_hover_highlight();
	};

	const handle_entry_group_state_change = () => {
		clear_hover_highlight();
		schedule_sidebar_measurement();
		update_nav_chrome();
	};

	const handle_nav_resize = () => {
		schedule_sidebar_measurement();
		update_nav_chrome();
	};

	$effect(() => {
		if (!sidebar_panel) {
			return;
		}

		if (typeof ResizeObserver === "undefined") {
			schedule_sidebar_measurement();
			return;
		}

		const resize_observer = new ResizeObserver(schedule_sidebar_measurement);
		resize_observer.observe(sidebar_panel);

		if (nav_surface) {
			resize_observer.observe(nav_surface);
		}

		schedule_sidebar_measurement();

		return () => {
			if (typeof cancelAnimationFrame !== "undefined") {
				cancelAnimationFrame(sidebar_measurement_frame);
			}

			resize_observer.disconnect();
		};
	});

	$effect(() => {
		void current_href;
		void docs_nav_render_model;
		schedule_sidebar_measurement();
		schedule_selected_caret_update();
	});
</script>

<svelte:window onresize={handle_nav_resize} />

<div bind:this={sidebar_panel} class="t-sidebar-flyout flex flex-1 flex-col">
	<Sidebar.Header
		class="pl-6 pr-14 xl:pl-2"
	>
		<div class="t-sidebar-flyout-inline">
			<a
				href="/"
				class="t-sidebar-child flex flex-row items-center gap-2"
				style={get_sidebar_child_style(0, docs_nav_render_model.child_count)}
			>
				<img
					src={barekey_logo}
					alt=""
					class="size-5 shrink-0 invert dark:invert-0"
				/>
				<span class="font-logo">Barekey</span>
			</a>
		</div>
	</Sidebar.Header>

	<Sidebar.Content
		bind:ref={nav_surface}
		class="docs-sidebar-nav-surface overflow-x-hidden px-2 pb-3"
		onpointerleave={clear_hover_highlight}
	>
		<div
			class="docs-sidebar-hover-highlight"
			data-active={hover_highlight_visible}
			data-animate={hover_highlight_animated}
			aria-hidden="true"
			role="presentation"
			style={`--docs-sidebar-hover-x: ${hover_highlight_left}px; --docs-sidebar-hover-y: ${hover_highlight_top}px; --docs-sidebar-hover-width: ${hover_highlight_width}px; --docs-sidebar-hover-height: ${hover_highlight_height}px;`}
		></div>
		<div
			class="docs-sidebar-selected-caret"
			data-active={selected_caret_visible}
			data-animate={selected_caret_animated}
			aria-hidden="true"
			role="presentation"
			style={`--docs-sidebar-caret-x: ${selected_caret_left}px; --docs-sidebar-caret-y: ${selected_caret_top}px; --docs-sidebar-caret-line-height: ${selected_caret_line_height}px;`}
		></div>
		{#each docs_nav_render_model.groups as render_group (render_group.category)}
			<Sidebar.Group class="relative z-10 px-0 py-1">
				<Sidebar.GroupLabel
					class="t-sidebar-child h-5 px-3 font-heading text-sm font-semibold text-foreground"
					style={get_sidebar_child_style(
						render_group.child_index,
						docs_nav_render_model.child_count,
					)}
				>
					{render_group.nav_group.title}
				</Sidebar.GroupLabel>

				<ul
					data-slot="sidebar-menu-sub"
					data-sidebar="menu-sub"
					class="docs-sidebar-nav-list t-sidebar-menu-sub ml-3.5 mr-0 mt-1.5 flex min-w-0 translate-x-px flex-col border-l border-sidebar-border/70 pb-1 pl-2 pr-0 pt-0"
				>
					{#each render_group.sections as render_section (`${render_group.category}/${render_section.group_index}/${render_section.name ?? ""}`)}
						{const active_href = get_active_section_href(
							render_group.category,
							render_section,
							current_href,
						)}
						<DocsSidebarEntryGroup
							{active_href}
							collapsible={render_section.collapsible}
							gap={get_nav_group_label_gap(render_section.group_index)}
							label_style={render_section.label_child_index === null
								? ""
								: get_sidebar_child_style(
									render_section.label_child_index,
									docs_nav_render_model.child_count,
								)}
							name={render_section.name}
							on_pointer_enter={show_hover_highlight}
							on_state_change={handle_entry_group_state_change}
							on_state_change_complete={handle_entry_group_state_change}
						>
			{#each render_section.entry_groups as render_entry_group (render_entry_group.group_index)}
				{const has_group_label = Boolean(
					render_entry_group.name || render_entry_group.category,
				)}
				{#if render_entry_group.category}
					<li
						class="docs-sidebar-nav-category t-sidebar-child relative z-10 flex h-5 items-center px-2.5 font-heading text-xs font-semibold text-foreground"
						data-gap={render_entry_group.name ? "after-group-label" : "group"}
						style={render_entry_group.category_child_index === null
							? ""
							: get_sidebar_child_style(
									render_entry_group.category_child_index,
									docs_nav_render_model.child_count,
								)}
					>
						<span class="docs-sidebar-nav-category-label-text whitespace-nowrap">
							{render_entry_group.category}
						</span>
					</li>
				{/if}
				{#each render_entry_group.entries as render_entry, entry_index (`${render_group.category}/${render_entry.slug}`)}
									{const title = get_nav_entry_name(
										render_entry.slug,
										render_entry.nav_entry,
									)}
									{const href = get_docs_href({
										category: render_group.category,
										slug: render_entry.slug,
									})}

									<Sidebar.MenuSubItem
										class="docs-sidebar-nav-item t-sidebar-child relative z-10"
										data-gap={get_nav_entry_gap(
											render_entry_group.group_index,
											entry_index,
											has_group_label,
										)}
										style={get_sidebar_child_style(
											render_entry.child_index,
											docs_nav_render_model.child_count,
										)}
									>
										<a
											{href}
											title={title}
											aria-current={href === current_href ? "page" : undefined}
											data-active={href === current_href}
											data-sidebar="menu-sub-button"
											class="docs-sidebar-nav-link group/docs-nav flex h-7 w-full min-w-0 items-center rounded-full px-2.5 text-sm font-medium outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
											onclick={() =>
												track_docs_nav_click({
													category: render_group.category,
													slug: render_entry.slug,
													doc_title: title,
												})}
											onpointerenter={show_hover_highlight}
										>
											<span class="docs-sidebar-nav-link-text truncate whitespace-nowrap">{title}</span>
										</a>
									</Sidebar.MenuSubItem>
								{/each}
							{/each}
						</DocsSidebarEntryGroup>
					{/each}
				</ul>
			</Sidebar.Group>
		{/each}
	</Sidebar.Content>
</div>
