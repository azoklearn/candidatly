/**
 * Who may open /admin: the accounts listed in ADMIN_EMAILS, compared without case or
 * spacing. An empty list closes the page for everyone (docs/RUNBOOK.md, « Page admin »).
 */

export function parseAdminEmails(value: string | null | undefined): ReadonlySet<string> {
  return new Set(
    (value ?? "")
      .split(/[,;\s]+/)
      .map((email) => email.trim().toLowerCase())
      .filter((email) => email.includes("@")),
  );
}

export function isAdminEmail(
  email: string | null | undefined,
  admins: ReadonlySet<string>,
): boolean {
  if (!email || admins.size === 0) return false;
  return admins.has(email.trim().toLowerCase());
}
