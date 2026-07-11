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
		label: string;
	};

	let {
		class: class_name,
		copied_label = "Copied",
		copy_kind,
		feedback_text = "Copied to clipboard.",
		heading_id,
		label,
	}: Props = $props();
</script>

<button
	class={cn("docs-copy-button", class_name)}
	type="button"
	aria-label={label}
	data-copy-label={label}
	data-copied-label={copied_label}
	data-copy-kind={copy_kind}
	data-copy-state="idle"
	data-heading-id={heading_id}
>
	<span class="docs-copy-button-icon-stack" aria-hidden="true">
		<span class="docs-copy-button-icon-layer">
			<Copy class="docs-copy-button-icon docs-copy-button-icon-idle" />
		</span>
		<span class="docs-copy-button-icon-layer">
			<Check class="docs-copy-button-icon docs-copy-button-icon-success" />
		</span>
	</span>
	<FloatingFeedback text={feedback_text} />
</button>
