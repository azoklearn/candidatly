import Link from "next/link";

import { APP_NAME, SITE_DOMAIN } from "@/lib/brand";

/** Logo: tilted "J" mark and the site address, so a filmed screen says where to go (C110). */
export function BrandLink({ href = "/" }: { href?: string }) {
  return (
    <Link
      href={href}
      aria-label={`${APP_NAME}, accueil`}
      className="inline-flex items-center gap-2 text-[19px] font-bold tracking-[-0.055em]"
    >
      <span className="brand-mark" aria-hidden>
        J
      </span>
      <Wordmark />
    </Link>
  );
}

/** "gptjob" in ink, ".io" in the brand colour. */
export function Wordmark() {
  const dot = SITE_DOMAIN.lastIndexOf(".");
  return (
    <span>
      {SITE_DOMAIN.slice(0, dot)}
      <span className="text-brand">{SITE_DOMAIN.slice(dot)}</span>
    </span>
  );
}
