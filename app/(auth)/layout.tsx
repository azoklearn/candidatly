import type { ReactNode } from "react";

import { BrandLink } from "@/components/brand-link";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="relative flex min-h-svh flex-col items-center justify-center gap-8 overflow-hidden px-4 py-12">
      <div className="app-grain" aria-hidden />
      <div
        aria-hidden
        className="pointer-events-none absolute -top-48 left-1/2 size-[560px] -translate-x-1/2 rounded-full bg-brand-soft/35 blur-3xl"
      />
      <div className="relative">
        <BrandLink />
      </div>
      <div className="fade-up relative w-full max-w-sm">{children}</div>
      <p className="relative font-serif text-lg text-muted-foreground italic">
        Cherchez moins. Choisissez mieux.
      </p>
    </main>
  );
}
