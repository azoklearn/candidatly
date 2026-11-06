/**
 * How alive the student's own selection is, read from their matches and nothing else: how
 * many of their offers were published in the last week and how fresh the most recent one
 * is. It is the only urgency argument the plans page is allowed to make, because it is the
 * only one that is measured (no invented figure, docs/QUESTIONS.md C73).
 */

const HOUR_MS = 3_600_000;
const DAY_MS = 86_400_000;
export const PULSE_WINDOW_DAYS = 7;

export type PulseRow = { published_at: string | null };

export type SearchPulse = {
  /** Offers of the selection published within the last PULSE_WINDOW_DAYS. */
  lastWeek: number;
  /** "il y a 3 heures" for the most recent offer, null when no date is known. */
  newestLabel: string | null;
};

function freshness(ms: number): string {
  if (ms < HOUR_MS) return "à l’instant";
  if (ms < DAY_MS) {
    const hours = Math.max(1, Math.floor(ms / HOUR_MS));
    return `il y a ${hours} heure${hours > 1 ? "s" : ""}`;
  }
  const days = Math.floor(ms / DAY_MS);
  if (days === 1) return "hier";
  return `il y a ${days} jours`;
}

export function searchPulse(rows: PulseRow[], now: Date = new Date()): SearchPulse {
  let lastWeek = 0;
  let newest: number | null = null;
  for (const row of rows) {
    if (!row.published_at) continue;
    const time = new Date(row.published_at).getTime();
    if (Number.isNaN(time)) continue;
    const age = now.getTime() - time;
    // A date in the future would make the label read oddly: treat it as just published.
    const clamped = Math.max(0, age);
    if (clamped < PULSE_WINDOW_DAYS * DAY_MS) lastWeek++;
    if (newest === null || clamped < newest) newest = clamped;
  }
  return { lastWeek, newestLabel: newest === null ? null : freshness(newest) };
}

/** The sentence shown next to the live dot, or null when there is nothing true to say. */
export function pulseSentence(pulse: SearchPulse): string | null {
  const parts: string[] = [];
  if (pulse.lastWeek > 0) {
    parts.push(
      `${pulse.lastWeek} offre${pulse.lastWeek > 1 ? "s" : ""} de ta sélection publiée${
        pulse.lastWeek > 1 ? "s" : ""
      } ces ${PULSE_WINDOW_DAYS} derniers jours`,
    );
  }
  if (pulse.newestLabel) parts.push(`la plus récente ${pulse.newestLabel}`);
  return parts.length > 0 ? parts.join(" · ") : null;
}
