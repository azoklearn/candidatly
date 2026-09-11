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
  // A lone space between two changed words belongs to the change: one highlight, not two.
  for (let i = 1; i < merged.length - 1; i++) {
    const [previous, current, next] = [merged[i - 1], merged[i], merged[i + 1]];
    if (
      current?.type === "equal" &&
      /^\s+$/.test(current.text) &&
      previous?.type === "insert" &&
      next?.type === "insert"
    ) {
      previous.text += current.text + next.text;
      merged.splice(i, 2);
      i--;
    }
  }
  return merged;
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
  return merge(segments);
}

/** Gives each inserted passage the reason of the change it comes from, or marks it as the student's. */
export function annotateSegments(
  segments: DiffSegment[],
  changes: { replacement: string; reason: string }[],
): AnnotatedSegment[] {
  return segments.map((segment) => {
    const text = segment.text.trim();
    if (segment.type !== "insert" || !text) return segment;
    const change = changes.find((candidate) => candidate.replacement.includes(text));
    return { ...segment, reason: change?.reason ?? "Modifié par vous." };
  });
}
