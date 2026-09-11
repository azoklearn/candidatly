/** Word-level differences between the base letter and an adapted one, for the highlighted view. */

export type DiffSegment = { type: "equal" | "insert" | "delete"; text: string };
export type AnnotatedSegment = DiffSegment & { reason?: string };

const MAX_CELLS = 4_000_000;

const tokens = (text: string) => text.match(/\s+|[^\s]+/g) ?? [];

function merge(segments: DiffSegment[]): DiffSegment[] {
  const merged: DiffSegment[] = [];
  for (const segment of segments) {
    if (!segment.text) continue;
    const last = merged.at(-1);
    if (last && last.type === segment.type) last.text += segment.text;
    else merged.push({ ...segment });
  }
  return merged;
}

/**
 * Turns interleaved changes ("pour une" struck, "en" added, "alternance" kept...) into one
 * struck passage followed by one added passage whenever only spaces separate them.
 */
function groupChanges(segments: DiffSegment[]): DiffSegment[] {
  const grouped: DiffSegment[] = [];
  let i = 0;
  while (i < segments.length) {
    const first = segments[i];
    if (!first || first.type === "equal") {
      if (first) grouped.push(first);
      i++;
      continue;
    }
    let removed = "";
    let added = "";
    let hasRemoved = false;
    let hasAdded = false;
    while (i < segments.length) {
      const segment = segments[i];
      const next = segments[i + 1];
      if (segment?.type === "delete") {
        removed += segment.text;
        hasRemoved = true;
      } else if (segment?.type === "insert") {
        added += segment.text;
        hasAdded = true;
      } else if (segment && /^\s+$/.test(segment.text) && next && next.type !== "equal") {
        removed += segment.text;
        added += segment.text;
      } else {
        break;
      }
      i++;
    }
    if (hasRemoved) grouped.push({ type: "delete", text: removed });
    if (hasAdded) grouped.push({ type: "insert", text: added });
  }
  return grouped;
}

/** Longest common subsequence on words and spaces; plain replace when the texts are huge. */
export function diffWords(before: string, after: string): DiffSegment[] {
  const a = tokens(before);
  const b = tokens(after);
  const n = a.length;
  const m = b.length;
  if ((n + 1) * (m + 1) > MAX_CELLS) {
    return merge([
      { type: "delete", text: before },
      { type: "insert", text: after },
    ]);
  }
  const width = m + 1;
  const table = new Uint32Array((n + 1) * width);
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      table[i * width + j] =
        a[i] === b[j]
          ? (table[(i + 1) * width + j + 1] ?? 0) + 1
          : Math.max(table[(i + 1) * width + j] ?? 0, table[i * width + j + 1] ?? 0);
    }
  }
  const segments: DiffSegment[] = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (a[i] === b[j]) {
      segments.push({ type: "equal", text: a[i] ?? "" });
      i++;
      j++;
    } else if ((table[(i + 1) * width + j] ?? 0) >= (table[i * width + j + 1] ?? 0)) {
      segments.push({ type: "delete", text: a[i] ?? "" });
      i++;
    } else {
      segments.push({ type: "insert", text: b[j] ?? "" });
      j++;
    }
  }
  while (i < n) segments.push({ type: "delete", text: a[i++] ?? "" });
  while (j < m) segments.push({ type: "insert", text: b[j++] ?? "" });
  return groupChanges(merge(segments));
}

const words = (value: string) =>
  value
    .split(/\s+/)
    .map((word) => word.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}]+$/gu, ""))
    .filter(Boolean);

function containsWords(haystack: string, needle: string): boolean {
  const all = words(haystack);
  const part = words(needle);
  if (part.length === 0) return false;
  for (let start = 0; start + part.length <= all.length; start++) {
    if (part.every((word, offset) => all[start + offset] === word)) return true;
  }
  return false;
}

/** Gives each inserted passage the reason of the change it comes from, or marks it as the student's. */
export function annotateSegments(
  segments: DiffSegment[],
  changes: { replacement: string; reason: string }[],
): AnnotatedSegment[] {
  return segments.map((segment) => {
    const text = segment.text.trim();
    if (segment.type !== "insert" || !text) return segment;
    // The most specific change whose replacement contains the passage as whole words.
    const change = changes
      .filter((candidate) => containsWords(candidate.replacement, text))
      .sort((a, b) => a.replacement.length - b.replacement.length)[0];
    return { ...segment, reason: change?.reason ?? "Modifié par vous." };
  });
}
