import { beforeEach, describe, expect, it } from "vitest";

import { USER_AGENT } from "@/lib/brand";
import {
  extractPageText,
  fetchCompanyWebsite,
  findAboutLink,
  parseRobots,
  resetWebsiteThrottle,
  toSafeHttpUrl,
} from "@/lib/enrichment/website";

type Page = { status?: number; body: string; type?: string };

function fakeSite(pages: Record<string, Page>) {
  const calls: { url: string; userAgent: string | null; at: number }[] = [];
  let now = 1_000_000;
  const clock = () => now;
  const sleep = async (ms: number) => {
    now += ms;
  };
  const fetchImpl = async (input: URL | string, init?: RequestInit) => {
    const url = String(input);
    calls.push({ url, userAgent: new Headers(init?.headers).get("user-agent"), at: now });
    const page = pages[url];
    if (!page)
      return new Response("absent", { status: 404, headers: { "content-type": "text/plain" } });
    return new Response(page.body, {
      status: page.status ?? 200,
      headers: { "content-type": page.type ?? "text/html; charset=utf-8" },
    });
  };
  return { calls, clock, sleep, fetchImpl };
}

const HOME = `<!doctype html><html><head><title>Acme &amp; Fils</title>
<meta content="Nous fabriquons des meubles en bois local depuis 1990." name="description">
<script>var tracking = "secret";</script><style>.a{}</style></head>
<body><nav><a href="/">Accueil</a><a href="/qui-sommes-nous">Qui sommes-nous ?</a></nav>
<h1>Meubles sur mesure</h1><p>Atelier de menuiserie à Angers.</p><p>Atelier de menuiserie à Angers.</p>
<a href="https://ailleurs.fr/about">Partenaire</a><footer>Mentions légales</footer></body></html>`;
const ABOUT = `<html><body><h1>Notre histoire</h1><p>Fondée par deux ébénistes, l'entreprise emploie douze personnes.</p></body></html>`;

beforeEach(() => resetWebsiteThrottle());

describe("toSafeHttpUrl", () => {
  it("accepts public web addresses and adds https when missing", () => {
    expect(toSafeHttpUrl("www.acme.fr")?.toString()).toBe("https://www.acme.fr/");
    expect(toSafeHttpUrl("http://acme.fr/fr#top")?.toString()).toBe("http://acme.fr/fr");
  });

  it("refuses local, private, credentialed and non-web addresses", () => {
    for (const value of [
      "http://127.0.0.1",
      "http://169.254.169.254/latest",
      "http://localhost:3000",
      "http://intranet",
      "http://[::1]/",
      "ftp://acme.fr",
      "http://user:pw@acme.fr",
      "http://acme.fr:8080",
      "",
      null,
    ]) {
      expect(toSafeHttpUrl(value)).toBeNull();
    }
  });
});

describe("parseRobots", () => {
  it("applies the wildcard group, the longest rule and Allow on ties", () => {
    const allowed = parseRobots(
      "User-agent: *\nDisallow: /private\nAllow: /private/public\nDisallow: /*.pdf$",
    );
    expect(allowed("/")).toBe(true);
    expect(allowed("/private/x")).toBe(false);
    expect(allowed("/private/public/page")).toBe(true);
    expect(allowed("/doc.pdf")).toBe(false);
    expect(allowed("/doc.pdf?x=1")).toBe(true);
  });

  it("prefers a group naming our user agent", () => {
    const allowed = parseRobots(
      "User-agent: Candidatly/1.0\nDisallow: /\n\nUser-agent: *\nAllow: /",
    );
    expect(allowed("/")).toBe(false);
    expect(parseRobots("User-agent: *\nDisallow:")("/anything")).toBe(true);
  });
});

describe("page reading", () => {
  it("keeps the title, the meta description and readable text only", () => {
    const page = extractPageText(HOME);
    expect(page.title).toBe("Acme & Fils");
    expect(page.description).toBe("Nous fabriquons des meubles en bois local depuis 1990.");
    expect(page.text).toContain("Meubles sur mesure");
    expect(page.text).not.toContain("tracking");
    expect(page.text).not.toContain("Mentions légales");
    expect(page.text.match(/Atelier de menuiserie/g)).toHaveLength(1);
  });

  it("finds a same-site about page only", () => {
    expect(findAboutLink(HOME, new URL("https://www.acme.fr/"))?.toString()).toBe(
      "https://www.acme.fr/qui-sommes-nous",
    );
    expect(
      findAboutLink(
        '<a href="https://ailleurs.fr/a-propos">À propos</a>',
        new URL("https://acme.fr/"),
      ),
    ).toBeNull();
  });
});

describe("fetchCompanyWebsite", () => {
  it("reads the home and about pages, spacing calls to the same domain", async () => {
    const site = fakeSite({
      "https://www.acme.fr/robots.txt": {
        body: "User-agent: *\nDisallow: /admin",
        type: "text/plain",
      },
      "https://www.acme.fr/": { body: HOME },
      "https://www.acme.fr/qui-sommes-nous": { body: ABOUT },
    });
    const result = await fetchCompanyWebsite("www.acme.fr", site);
    expect(result.status).toBe("ok");
    if (result.status !== "ok") return;
    expect(result.sources).toEqual(["https://www.acme.fr/", "https://www.acme.fr/qui-sommes-nous"]);
    expect(result.text).toContain("Fondée par deux ébénistes");
    expect(result.text.length).toBeLessThanOrEqual(6_000);
    expect(site.calls.map((call) => call.userAgent)).toEqual([USER_AGENT, USER_AGENT, USER_AGENT]);
    const gaps = site.calls.slice(1).map((call, index) => call.at - (site.calls[index]?.at ?? 0));
    expect(gaps.every((gap) => gap >= 2_000)).toBe(true);
  });

  it("stops when robots.txt disallows the site", async () => {
    const site = fakeSite({
      "https://acme.fr/robots.txt": { body: "User-agent: *\nDisallow: /", type: "text/plain" },
    });
    expect(await fetchCompanyWebsite("https://acme.fr", site)).toEqual({ status: "blocked" });
    expect(site.calls).toHaveLength(1);
  });

  it("reports unreachable sites and refuses unsafe addresses without calling them", async () => {
    const failing = {
      ...fakeSite({}),
      fetchImpl: async () => {
        throw new TypeError("fetch failed");
      },
    };
    expect(await fetchCompanyWebsite("https://acme.fr", failing)).toEqual({
      status: "unreachable",
    });
    const site = fakeSite({});
    expect(await fetchCompanyWebsite("http://10.0.0.1/", site)).toEqual({ status: "invalid" });
    expect(site.calls).toHaveLength(0);
  });
});
