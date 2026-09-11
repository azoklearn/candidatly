import type { ReactNode } from "react";

import { BrandLink } from "@/components/brand-link";

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-svh">
      <header className="mx-auto w-full max-w-2xl px-4 pt-6">
        <BrandLink />
      </header>
      {children}
    </div>
  );
}
