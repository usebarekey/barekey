import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

function Spinner({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <Skeleton
      role="status"
      aria-label="Loading"
      className={cn("size-4 rounded-full", className)}
      {...props}
    />
  );
}

export { Spinner };
