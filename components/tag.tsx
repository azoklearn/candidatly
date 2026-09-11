import type { ReactNode } from "react";

/** Small rounded label for offer and company facts. */
export function Tag({ children }: { children: ReactNode }) {
  return (
    <span className="rounded-full border border-foreground/10 bg-secondary px-2.5 py-0.5 text-xs text-secondary-foreground">
      {children}
    </span>
  );
}
