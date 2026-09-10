import Link from "next/link";
import type { ReactNode } from "react";

import { APP_NAME } from "@/lib/brand";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-6 bg-muted/40 px-4 py-12">
      <Link href="/" className="text-lg font-semibold tracking-tight">
        {APP_NAME}
      </Link>
      <div className="w-full max-w-sm">{children}</div>
    </main>
  );
}
