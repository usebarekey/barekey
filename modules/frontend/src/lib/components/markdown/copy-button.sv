<script lang="ts">
	import { cn } from "$lib/utils";
	import Copy from "@tabler/icons-svelte/icons/copy";
	import Check from "@tabler/icons-svelte/icons/check";
	import FloatingFeedback from "$lib/components/ui/floating-feedback/floating-feedback.sv";

	type CopyKind = "code" | "command" | "heading-link";

	type Props = {
		class?: string;
		copied_label?: string;
		copy_kind: CopyKind;
		feedback_text?: string;
		heading_id?: string;
		icon_class?: string;
		label: string;
	};

	let {
		class: class_name,
		copied_label = "Copied",
		copy_kind,
		feedback_text = "Copied to clipboard.",
		heading_id,
		icon_class,
		label,
	}: Props = $props();
</script>

<button
	class={cn(
		"docs-copy-button group/docs-copy flex items-center justify-center rounded-full bg-linear-to-b from-foreground/7.5 to-foreground/2.5 p-2 leading-none card-lg",
		class_name,
	)}
	type="button"
	aria-label={label}
	data-copy-label={label}
	data-copied-label={copied_label}
	data-copy-kind={copy_kind}
	data-copy-state="idle"
	data-heading-id={heading_id}
>
	<span class="relative grid size-4 place-items-center" aria-hidden="true">
		<span class="col-start-1 row-start-1 flex size-4 items-center justify-center">
			<Copy
				class={cn(
					"size-4 text-muted-foreground transition-all duration-(--duration-fast) ease-in-out group-hover/docs-copy:text-foreground group-data-[copy-state=success]/docs-copy:scale-75 group-data-[copy-state=success]/docs-copy:opacity-0 motion-reduce:transition-none",
					icon_class,
				)}
			/>
		</span>
		<span class="col-start-1 row-start-1 flex size-4 items-center justify-center">
			<Check
				class={cn(
					"size-4 scale-75 text-muted-foreground opacity-0 transition-all duration-(--duration-fast) ease-in-out group-hover/docs-copy:text-foreground group-data-[copy-state=success]/docs-copy:scale-100 group-data-[copy-state=success]/docs-copy:opacity-100 motion-reduce:transition-none",
					icon_class,
				)}
			/>
		</span>
	</span>
	<FloatingFeedback text={feedback_text} />
</button>
