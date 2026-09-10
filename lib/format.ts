/** French display helpers for the offer screens. */

const DATE_FORMAT = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "Europe/Paris",
});

export function formatDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : DATE_FORMAT.format(date);
}

export function formatRelativeDays(
  iso: string | null | undefined,
  now: Date = new Date(),
): string | null {
  if (!iso) return null;
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return null;
  const days = Math.floor((now.getTime() - date.getTime()) / 86_400_000);
  if (days <= 0) return "aujourd’hui";
  if (days === 1) return "hier";
  return `il y a ${days} jours`;
}

export function formatDistance(km: number): string {
  return km < 1 ? "moins d’1 km" : `${Math.round(km)} km`;
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(
      /(^|[\s-])(\p{L})/gu,
      (_match, separator: string, letter: string) => separator + letter.toUpperCase(),
    );
}

/** "20 AVENUE DE SEGUR 75007 PARIS" gives "Paris". */
export function cityFromAddress(address: string | null | undefined): string | null {
  if (!address) return null;
  const match = address.match(/\b\d{5}\s+(.+)$/);
  return titleCase((match?.[1] ?? address).trim());
}

export const DIPLOMA_LABELS: Record<number, string> = {
  3: "CAP, BEP",
  4: "Bac",
  5: "Bac+2",
  6: "Bac+3 ou Bac+4",
  7: "Bac+5",
};

export const REMOTE_LABELS: Record<string, string> = {
  onsite: "Sur site",
  remote: "Télétravail",
  hybrid: "Hybride",
};

export function contractLabel(types: string[]): string {
  const labels = types.map((type) =>
    type === "apprentissage"
      ? "Apprentissage"
      : type === "professionnalisation"
        ? "Professionnalisation"
        : type,
  );
  return labels.join(" ou ") || "Alternance";
}
