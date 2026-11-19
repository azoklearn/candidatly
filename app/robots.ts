import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/brand";

/** Search engines read the public pages only (docs/QUESTIONS.md C122). */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: [
        "/api/",
        "/auth/",
        "/onboarding/",
        "/dashboard",
        "/offers",
        "/applications",
        "/companies",
        "/account",
        "/forfait",
        "/credits",
        "/admin",
      ],
    },
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
