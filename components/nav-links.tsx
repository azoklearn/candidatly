"use client";

import { cn } from "cn";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAVIGATION = [
  { href: "/offers", label: "Offres" },
  { href: "/applications", label: "Candidatures" },
  { href: "/account", label: "Compte" },
] as const;

export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav aria-label="Navigation principale" className="flex gap-1 text-sm">
      {NAVIGATION.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "rounded-full px-3 py-1.5 font-medium transition-colors",
              active
                ? "bg-foreground text-background"
                : "text-muted-foreground hover:bg-foreground/5 hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
