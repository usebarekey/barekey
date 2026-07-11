import type { Component, Snippet } from "svelte";

/**
 * A helper class to make it easy to identify Svelte components in
 * `columnDef.cell` and `columnDef.header` properties.
 *
 * > NOTE: This class should only be used internally by the adapter. If you're
 * reading this and you don't know what this is for, you probably don't need it.
 *
 * @example
 * ```svelte
 * {@const result = content(context)}
 * {#if result instanceof RenderComponentConfig}
 *   {@const { component: Component, props } = result}
 *   <Component {...props} />
 * {/if}
 * ```
 */
export class RenderComponentConfig<
	Props extends Record<string, unknown>,
	TComponent extends Component<Props>,
> {
	component: TComponent;
	props: Props | Record<string, never>;
	constructor(component: TComponent, props: Props | Record<string, never> = {}) {
		this.component = component;
		this.props = props;
	}
}

/**
 * A helper class to make it easy to identify Svelte Snippets in `columnDef.cell` and `columnDef.header` properties.
 *
 * > NOTE: This class should only be used internally by the adapter. If you're
 * reading this and you don't know what this is for, you probably don't need it.
 *
 * @example
 * ```svelte
 * {@const result = content(context)}
 * {#if result instanceof RenderSnippetConfig}
 *   {@const { snippet, params } = result}
 *   {@render snippet(params)}
 * {/if}
 * ```
 */
export class RenderSnippetConfig<TProps> {
	snippet: Snippet<[TProps]>;
	params: TProps;
	constructor(snippet: Snippet<[TProps]>, params: TProps) {
		this.snippet = snippet;
		this.params = params;
	}
}

/**
 * A helper function to help create cells from Svelte components through ColumnDef's `cell` and `header` properties.
 *
 * This is only to be used with Svelte Components - use `render_snippet` for Svelte Snippets.
 *
 * @example
 * ```ts
 * const defaultColumns = [
 *   columnHelper.accessor('name', {
 *     header: header => render_component(SortHeader, { label: 'Name', header }),
 *   }),
 *   columnHelper.accessor('state', {
 *     header: header => render_component(SortHeader, { label: 'State', header }),
 *   }),
 * ]
 * ```
 * @see {@link https://tanstack.com/table/latest/docs/guide/column-defs}
 */
export function render_component<Props extends Record<string, unknown>, T extends Component<Props>>(
	component: T,
	props: Props = {} as Props,
) {
	return new RenderComponentConfig(component, props);
}

/**
 * A helper function to help create cells from Svelte Snippets through ColumnDef's `cell` and `header` properties.
 *
 * The snippet must only take one parameter.
 *
 * This is only to be used with Snippets - use `render_component` for Svelte Components.
 *
 * @example
 * ```ts
 * const defaultColumns = [
 *   columnHelper.accessor('name', {
 *     cell: cell => render_snippet(nameSnippet, { name: cell.row.name }),
 *   }),
 *   columnHelper.accessor('state', {
 *     cell: cell => render_snippet(stateSnippet, { state: cell.row.state }),
 *   }),
 * ]
 * ```
 * @see {@link https://tanstack.com/table/latest/docs/guide/column-defs}
 */
export function render_snippet<TProps>(snippet: Snippet<[TProps]>, params: TProps = {} as TProps) {
	return new RenderSnippetConfig(snippet, params);
}
