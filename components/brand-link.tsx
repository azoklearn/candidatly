import Link from "next/link";

import { APP_NAME } from "@/lib/brand";

/** Logo of the landing page: tilted "C" mark and word mark. */
export function BrandLink({ href = "/" }: { href?: string }) {
  return (
    <Link
      href={href}
      aria-label={`${APP_NAME}, accueil`}
      className="inline-flex items-center gap-2 text-[19px] font-bold tracking-[-0.055em]"
    >
      <span className="brand-mark" aria-hidden>
        C
      </span>
      <span>{APP_NAME}</span>
    </Link>
  );
}
