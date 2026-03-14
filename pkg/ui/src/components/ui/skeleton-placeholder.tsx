import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

type SkeletonPlaceholderProps = {
  content: React.ReactNode;
  className?: string;
  contentClassName?: string;
  skeletonClassName?: string;
};

function SkeletonPlaceholder({
  content,
  className,
  contentClassName,
  skeletonClassName,
}: SkeletonPlaceholderProps) {
  return (
    <div aria-hidden="true" className={cn("relative overflow-hidden", className)}>
      <Skeleton className={cn("absolute inset-0 size-full rounded-[inherit]", skeletonClassName)} />
      <div className={cn("invisible", contentClassName)}>{content}</div>
    </div>
  );
}

export { SkeletonPlaceholder };
