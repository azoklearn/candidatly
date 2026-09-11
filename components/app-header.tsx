import Link from "next/link";

import { signOut } from "@/app/(auth)/actions";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/brand";

const NAVIGATION = [
  { href: "/offers", label: "Offres" },
  { href: "/applications", label: "Candidatures" },
  { href: "/account", label: "Compte" },
] as const;

export function AppHeader({ firstName }: { firstName: string | null }) {
  return (
    <header className="border-b">
      <div className="mx-auto flex w-full max-w-5xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
        <Link href="/offers" className="font-semibold tracking-tight">
          {APP_NAME}
        </Link>
        <nav aria-label="Navigation principale" className="flex gap-4 text-sm">
          {NAVIGATION.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="text-muted-foreground hover:text-foreground"
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <div className="ml-auto flex items-center gap-3 text-sm">
          {firstName ? <span className="text-muted-foreground">{firstName}</span> : null}
          <form action={signOut}>
            <Button type="submit" variant="ghost" size="sm">
              Se déconnecter
            </Button>
          </form>
        </div>
      </div>
    </header>
  );
}
