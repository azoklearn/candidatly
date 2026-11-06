"use client";

import { cn } from "cn";
import Link from "next/link";
import { usePathname } from "next/navigation";

const NAVIGATION = [
  { href: "/offers", label: "Offres" },
  { href: "/applications", label: "Candidatures" },
  { href: "/account", label: "Compte" },
] as const;

/** Navigation of the landing page: a rule grows under the link, and stays on the page you are on. */
export function NavLinks() {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Navigation principale"
      className="flex gap-5 text-[0.8125rem] sm:gap-7 sm:pl-6"
    >
      {NAVIGATION.map((item) => {
        const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "nav-sweep",
              active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
