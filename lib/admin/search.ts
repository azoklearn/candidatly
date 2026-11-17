/** The search box of /admin (C112): one text matched against address, name and city. */

const fold = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

export function matchesAccountQuery(
  account: { email: string | null; name: string | null; location: string | null },
  query: string | null | undefined,
): boolean {
  const needle = fold(query ?? "");
  if (needle.length === 0) return true;
  return [account.email, account.name, account.location].some(
    (value) => value !== null && fold(value).includes(needle),
  );
}

/** A user id from the URL, refused unless it has the shape of a uuid. */
export function parseUserId(value: string): string | null {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value)
    ? value.toLowerCase()
    : null;
}
