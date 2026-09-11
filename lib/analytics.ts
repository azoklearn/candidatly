/**
 * Page addresses sent to Vercel Web Analytics (docs/QUESTIONS.md C84) keep only the path:
 * query strings (sign-in tokens, typed filters) and fragments are dropped, and identifiers
 * in the path become "[id]", so no visit can be tied to an application or a student.
 */

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function anonymizeUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return value.split(/[?#]/)[0] ?? "";
  }
  const path = url.pathname
    .split("/")
    .map((segment) => (UUID.test(segment) ? "[id]" : segment))
    .join("/");
  return `${url.origin}${path}`;
}
