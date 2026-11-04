/** What the CV scan read, shown so the student can correct it (docs/QUESTIONS.md C95). */
export function ScanNote({ summary }: { summary: string | null }) {
  if (!summary) return null;
  return (
    <p className="q-in mb-6 grid gap-0.5 rounded-2xl border bg-card px-4 py-3 text-sm">
      <span>
        <span className="font-medium">D’après ton CV :</span>{" "}
        <span className="text-muted-foreground">{summary}</span>
      </span>
      <span className="text-xs text-muted-foreground">Corrige si ce n’est pas ça.</span>
    </p>
  );
}
