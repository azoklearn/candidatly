import { USER_AGENT } from "@/lib/brand";
import type { FetchLike } from "@/lib/http/fetch-json";
import { logger as defaultLogger, type Logger } from "@/lib/logger";
import { toPlainText } from "@/lib/text/html";

/**
 * Company website reading (brief section 3.3): the home page and one "about" page,
 * robots.txt respected, identifiable user agent, 8 s timeout, at most one request per
 * domain every 2 s, useful text only, 6 000 characters at most. Addresses come from
 * third-party offers, so only public http(s) hosts are fetched.
 */

export const WEBSITE_TIMEOUT_MS = 8_000;
export const DOMAIN_INTERVAL_MS = 2_000;
export const MAX_WEBSITE_TEXT = 6_000;
const MAX_BODY_BYTES = 1_500_000;
const MAX_ROBOTS_BYTES = 200_000;
const MAX_REDIRECTS = 3;
const ROBOTS_TOKEN = "candidatly";
const ABOUT_PATTERN = /(about|a-propos|apropos|qui-sommes-nous|quisommesnous|notre-histoire)/;
const LOCAL_HOST = /(^localhost$|\.localhost$|\.local$|\.internal$|\.lan$|\.home$)/;

/** A public http(s) URL, or null: no credentials, standard ports, no IP literal, no local name. */
export function toSafeHttpUrl(value: string | null | undefined): URL | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  let url: URL;
  try {
    url = new URL(/^[a-z][a-z0-9+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`);
  } catch {
    return null;
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") return null;
  if (url.username || url.password) return null;
  if (url.port && url.port !== "80" && url.port !== "443") return null;
  const host = url.hostname.toLowerCase();
  if (!host.includes(".") || LOCAL_HOST.test(host)) return null;
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || host.startsWith("[")) return null;
  url.hash = "";
  return url;
}

type Rule = { allow: boolean; regex: RegExp; length: number };

const escapeRegex = (value: string) => value.replace(/[.+?^${}()|[\]\\]/g, "\\$&");

function ruleRegex(pattern: string): RegExp {
  const anchored = pattern.endsWith("$");
  const body = (anchored ? pattern.slice(0, -1) : pattern).split("*").map(escapeRegex).join(".*");
  return new RegExp(`^${body}${anchored ? "$" : ""}`);
}

/**
 * robots.txt rules for our user agent: its own group if there is one, otherwise "*".
 * The longest matching rule wins, and Allow wins a tie (RFC 9309).
 */
export function parseRobots(content: string, token = ROBOTS_TOKEN): (path: string) => boolean {
  const groups: { agents: string[]; rules: Rule[] }[] = [];
  let current: { agents: string[]; rules: Rule[] } | null = null;
  let lastWasAgent = false;
  for (const rawLine of content.split(/\r?\n/)) {
    const line = rawLine.replace(/#.*$/, "").trim();
    const match = /^([A-Za-z-]+)\s*:\s*(.*)$/.exec(line);
    if (!match) continue;
    const field = (match[1] ?? "").toLowerCase();
    const value = (match[2] ?? "").trim();
    if (field === "user-agent") {
      if (!current || !lastWasAgent) {
        current = { agents: [], rules: [] };
        groups.push(current);
      }
      current.agents.push(value.toLowerCase());
      lastWasAgent = true;
      continue;
    }
    lastWasAgent = false;
    if ((field === "allow" || field === "disallow") && current && value !== "") {
      current.rules.push({
        allow: field === "allow",
        regex: ruleRegex(value),
        length: value.length,
      });
    }
  }
  const own = groups.filter((group) =>
    group.agents.some((agent) => (agent.split("/")[0] ?? "").trim() === token),
  );
  const rules = (
    own.length > 0 ? own : groups.filter((group) => group.agents.includes("*"))
  ).flatMap((group) => group.rules);
  return (path) => {
    let best: Rule | null = null;
    for (const rule of rules) {
      if (!rule.regex.test(path)) continue;
      if (!best || rule.length > best.length || (rule.length === best.length && rule.allow)) {
        best = rule;
      }
    }
    return best ? best.allow : true;
  };
}

function parseAttributes(tag: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  for (const match of tag.matchAll(/([a-zA-Z_:.-]+)\s*=\s*("([^"]*)"|'([^']*)'|([^\s"'>]+))/g)) {
    attributes[(match[1] ?? "").toLowerCase()] = match[3] ?? match[4] ?? match[5] ?? "";
  }
  return attributes;
}

function cleanInline(value: string | undefined): string | null {
  if (!value) return null;
  const text = toPlainText(value).replace(/\s+/g, " ").trim();
  return text || null;
}

export type PageContent = { title: string | null; description: string | null; text: string };

/** Title, meta description and readable text of a page, without scripts, menus or footers. */
export function extractPageText(html: string): PageContent {
  const title = cleanInline(/<title[^>]*>([\s\S]*?)<\/title>/i.exec(html)?.[1]);
  let description: string | null = null;
  for (const tag of html.match(/<meta\b[^>]*>/gi) ?? []) {
    const attributes = parseAttributes(tag);
    const key = (attributes.name ?? attributes.property ?? "").toLowerCase();
    if ((key === "description" || key === "og:description") && attributes.content) {
      const content = cleanInline(attributes.content);
      if (key === "description" && content) {
        description = content;
        break;
      }
      description ??= content;
    }
  }
  const body = html
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(
      /<(script|style|noscript|svg|template|iframe|head|nav|footer|form|button|select)\b[\s\S]*?<\/\1\s*>/gi,
      " ",
    )
    .replace(/<\/\s*(section|article|header|main|tr|table|blockquote|dd|dt)\s*>/gi, "\n");
  const seen = new Set<string>();
  const lines: string[] = [];
  for (const line of toPlainText(body).split("\n")) {
    const trimmed = line.trim();
    const key = trimmed.toLowerCase();
    if (trimmed.length < 3 || seen.has(key)) continue;
    seen.add(key);
    lines.push(trimmed);
  }
  return { title, description, text: lines.join("\n") };
}

const slug = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");

const sameSite = (a: URL, b: URL) =>
  a.hostname.replace(/^www\./, "") === b.hostname.replace(/^www\./, "");

/** First same-site link that looks like an "about" page (brief section 3.3). */
export function findAboutLink(html: string, base: URL): URL | null {
  for (const match of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const href = parseAttributes(`<a ${match[1] ?? ""}>`).href;
    if (!href || href.startsWith("#") || /^(mailto|tel|javascript):/i.test(href)) continue;
    if (!ABOUT_PATTERN.test(slug(href)) && !ABOUT_PATTERN.test(slug(toPlainText(match[2] ?? "")))) {
      continue;
    }
    let url: URL;
    try {
      url = new URL(href, base);
    } catch {
      continue;
    }
    const safe = toSafeHttpUrl(url.toString());
    if (!safe || !sameSite(safe, base) || safe.pathname === base.pathname) continue;
    return safe;
  }
  return null;
}

type Deps = { fetchImpl: FetchLike; sleep: (ms: number) => Promise<void>; clock: () => number };

const lastRequestAt = new Map<string, number>();

/** Test helper: forgets when each domain was last called. */
export function resetWebsiteThrottle(): void {
  lastRequestAt.clear();
}

async function politeGet(
  url: URL,
  deps: Deps,
  accept: string,
): Promise<{ response: Response; url: URL } | null> {
  let current = url;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    const host = current.hostname;
    const wait =
      (lastRequestAt.get(host) ?? Number.NEGATIVE_INFINITY) + DOMAIN_INTERVAL_MS - deps.clock();
    if (wait > 0) await deps.sleep(wait);
    lastRequestAt.set(host, deps.clock());
    const response = await deps.fetchImpl(current, {
      headers: { "User-Agent": USER_AGENT, Accept: accept },
      redirect: "manual",
      signal: AbortSignal.timeout(WEBSITE_TIMEOUT_MS),
    });
    const location = response.headers.get("location");
    if (response.status >= 300 && response.status < 400 && location) {
      await response.body?.cancel();
      const next = toSafeHttpUrl(new URL(location, current).toString());
      if (!next) return null;
      current = next;
      continue;
    }
    return { response, url: current };
  }
  return null;
}

async function readLimited(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return "";
  const chunks: Uint8Array[] = [];
  let total = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      await reader.cancel();
      break;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0));
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.byteLength;
  }
  const charset = /charset=["']?([\w-]+)/i.exec(response.headers.get("content-type") ?? "")?.[1];
  try {
    return new TextDecoder(charset ?? "utf-8").decode(bytes);
  } catch {
    return new TextDecoder("utf-8").decode(bytes);
  }
}

type Robots = { kind: "rules"; allowed: (path: string) => boolean } | { kind: "unreachable" };

async function loadRobots(origin: URL, deps: Deps): Promise<Robots> {
  try {
    const result = await politeGet(new URL("/robots.txt", origin), deps, "text/plain");
    if (!result) return { kind: "rules", allowed: () => false };
    const { response } = result;
    if (response.status >= 400 && response.status < 500) {
      await response.body?.cancel();
      return { kind: "rules", allowed: () => true };
    }
    if (!response.ok) {
      await response.body?.cancel();
      return { kind: "rules", allowed: () => false };
    }
    return { kind: "rules", allowed: parseRobots(await readLimited(response, MAX_ROBOTS_BYTES)) };
  } catch {
    return { kind: "unreachable" };
  }
}

async function fetchPage(url: URL, deps: Deps): Promise<{ url: URL; html: string } | null> {
  const result = await politeGet(url, deps, "text/html,application/xhtml+xml");
  if (!result) return null;
  const { response } = result;
  if (!response.ok || !/html/i.test(response.headers.get("content-type") ?? "")) {
    await response.body?.cancel();
    return null;
  }
  return { url: result.url, html: await readLimited(response, MAX_BODY_BYTES) };
}

export type WebsiteResult =
  | {
      status: "ok";
      title: string | null;
      description: string | null;
      text: string;
      sources: string[];
    }
  | { status: "invalid" | "blocked" | "unreachable" };

const pathOf = (url: URL) => url.pathname + url.search;

export async function fetchCompanyWebsite(
  address: string | null | undefined,
  options: {
    fetchImpl?: FetchLike;
    sleep?: (ms: number) => Promise<void>;
    clock?: () => number;
    logger?: Logger;
  } = {},
): Promise<WebsiteResult> {
  const start = toSafeHttpUrl(address);
  if (!start) return { status: "invalid" };
  const deps: Deps = {
    fetchImpl: options.fetchImpl ?? fetch,
    sleep: options.sleep ?? ((ms) => new Promise<void>((resolve) => setTimeout(resolve, ms))),
    clock: options.clock ?? Date.now,
  };
  const log = (options.logger ?? defaultLogger).child({ area: "website", host: start.hostname });
  try {
    let robots = await loadRobots(start, deps);
    if (robots.kind === "unreachable") return { status: "unreachable" };
    if (!robots.allowed(pathOf(start))) return { status: "blocked" };
    const home = await fetchPage(start, deps);
    if (!home) return { status: "unreachable" };
    if (home.url.hostname !== start.hostname) {
      robots = await loadRobots(home.url, deps);
      if (robots.kind === "unreachable" || !robots.allowed(pathOf(home.url))) {
        return { status: "blocked" };
      }
    }
    const allowed = robots.allowed;
    const homeContent = extractPageText(home.html);
    const pages: { url: URL; content: PageContent }[] = [{ url: home.url, content: homeContent }];
    const aboutUrl = findAboutLink(home.html, home.url);
    if (aboutUrl && aboutUrl.hostname === home.url.hostname && allowed(pathOf(aboutUrl))) {
      const about = await fetchPage(aboutUrl, deps);
      if (about && about.url.hostname === home.url.hostname) {
        pages.push({ url: about.url, content: extractPageText(about.html) });
      }
    }
    const about = pages[1];
    const homeText = homeContent.text.slice(0, about ? MAX_WEBSITE_TEXT / 2 : MAX_WEBSITE_TEXT);
    const text = about
      ? `${homeText}\n\n${about.content.text}`.slice(0, MAX_WEBSITE_TEXT)
      : homeText;
    return {
      status: "ok",
      title: homeContent.title,
      description: homeContent.description ?? about?.content.description ?? null,
      text,
      sources: pages.map((page) => page.url.toString()),
    };
  } catch (error) {
    log.warn("website_unreachable", { error });
    return { status: "unreachable" };
  }
}
