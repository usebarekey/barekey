import { RenderComponentTag } from "./component-tags";

type CopyKind = "code" | "command" | "heading-link";

type CopyButtonOptions = {
	class_name?: string;
	copied_label?: string;
	copy_kind: CopyKind;
	feedback_text?: string;
	heading_id?: string;
	label: string;
};

export const RenderCopyButton = ({
	class_name,
	copied_label,
	copy_kind,
	feedback_text,
	heading_id,
	label,
}: CopyButtonOptions) =>
	RenderComponentTag("CopyButton", {
		class: class_name,
		copied_label,
		copy_kind,
		feedback_text,
		heading_id,
		label,
	});
