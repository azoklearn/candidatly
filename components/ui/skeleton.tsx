import { cn } from "cn";

/** Placeholder block with a soft shimmer, for loading states. */
function Skeleton({ className, ...props }: React.ComponentProps<"div">) {
  return <div data-slot="skeleton" aria-hidden className={cn("skeleton", className)} {...props} />;
}

export { Skeleton };
