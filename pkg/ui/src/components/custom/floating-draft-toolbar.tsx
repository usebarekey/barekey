import { Button } from "@/components/ui/button";

type FloatingDraftToolbarProps = {
  isVisible: boolean;
  message: string;
  isSaving?: boolean;
  saveLabel?: string;
  savingLabel?: string;
  discardLabel?: string;
  saveDisabled?: boolean;
  discardDisabled?: boolean;
  onSave: () => void;
  onDiscard: () => void;
  toolbarRef?: React.RefObject<HTMLDivElement | null>;
};

export function FloatingDraftToolbar({
  isVisible,
  message,
  isSaving = false,
  saveLabel = "Save changes",
  savingLabel = "Saving...",
  discardLabel = "Discard",
  saveDisabled = false,
  discardDisabled = false,
  onSave,
  onDiscard,
  toolbarRef,
}: FloatingDraftToolbarProps) {
  if (!isVisible) {
    return null;
  }

  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-5 z-50 flex justify-center px-4">
      <div
        ref={toolbarRef}
        className="pointer-events-auto flex max-w-[min(92vw,52rem)] items-center gap-3 rounded-xl border bg-card/95 px-3 py-2 shadow-xl backdrop-blur-sm"
      >
        <p className="pr-1 text-sm text-muted-foreground">{message}</p>
        <Button variant="outline" onClick={onDiscard} disabled={discardDisabled || isSaving}>
          {discardLabel}
        </Button>
        <Button onClick={onSave} disabled={saveDisabled || isSaving}>
          {isSaving ? savingLabel : saveLabel}
        </Button>
      </div>
    </div>
  );
}
