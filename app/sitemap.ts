import type { MetadataRoute } from "next";

import { SITE_URL } from "@/lib/brand";
import { GUIDES } from "@/lib/guides/guides";
import { PRESET_CITIES } from "@/lib/onboarding/cities";
import { JOB_DOMAINS } from "@/lib/onboarding/domains";

/** The public pages, for search engines (docs/QUESTIONS.md C122). Nothing behind the login. */
export default function sitemap(): MetadataRoute.Sitemap {
  const paths = [
    "/",
    "/tarifs",
    "/guides",
    "/outils/salaire-alternance",
    ...GUIDES.map((guide) => `/guides/${guide.slug}`),
    ...JOB_DOMAINS.map((domain) => `/alternance/${domain.id}`),
    ...PRESET_CITIES.map((city) => `/alternance/ville/${city.id}`),
    "/mentions-legales",
    "/confidentialite",
    "/conditions",
  ];
  return paths.map((path) => ({
    url: `${SITE_URL}${path === "/" ? "" : path}`,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority:
      path === "/" ? 1 : path.startsWith("/guides") || path.startsWith("/outils") ? 0.8 : 0.6,
  }));
}
