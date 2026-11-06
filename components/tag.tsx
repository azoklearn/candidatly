import type { ReactNode } from "react";

/** The small square label of the landing page feed: sky background, soft ink, no border. */
export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-md bg-[var(--pastel-sky)] px-2 py-1 text-[0.7rem] font-medium text-muted-foreground">
      {children}
    </span>
  );
}
