<script
	lang="ts"
	generics="TData extends RowData, TValue, TContext extends HeaderContext<TData, TValue> | CellContext<TData, TValue>"
>
	import type { CellContext, ColumnDefTemplate, HeaderContext, RowData } from "@tanstack/table-core";
	import { RenderComponentConfig, RenderSnippetConfig } from "$lib/components/ui/data-table/render-helpers.js";
	import type { Attachment } from "svelte/attachments";
	type Props = {
		/** The cell or header field of the current cell's column definition. */
		content?: ColumnDefTemplate<TContext>;
		/** The result of the `getContext()` function of the header or cell */
		context: TContext;

		/** Used to pass attachments that can't be gotten through context */
		attach?: Attachment;
	};

	let { content, context, attach }: Props = $props();
</script>

{#if typeof content === "string"}
	{content}
{:else if typeof content === "function"}
	{@const result = content(context)}
	{#if result instanceof RenderComponentConfig}
		{@const { component: Component, props } = result}
		<Component {...props} {attach} />
	{:else if result instanceof RenderSnippetConfig}
		{@const { snippet, params } = result}
		{@render snippet({ ...params, attach })}
	{:else}
		{result}
	{/if}
{/if}
