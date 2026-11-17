import type { ReactNode } from "react";

/** Building blocks shared by the /admin pages (C90, C112). */

export const APPLICATION_STATUS_LABELS: Record<string, string> = {
  draft: "Lettre en préparation",
  ready: "Prête à envoyer",
  sent: "Envoyée",
  viewed: "Vue",
  replied_positive: "Réponse positive",
  replied_negative: "Réponse négative",
  no_answer: "Sans réponse",
  unknown: "Statut inconnu",
};

export const MATCH_STATUS_LABELS: Record<string, string> = {
  new: "Nouvelles",
  saved: "Enregistrées",
  dismissed: "Ignorées",
  applied: "Candidatées",
};

export const CONTRACT_LABELS: Record<string, string> = {
  alternance: "Alternance",
  stage: "Stage",
  both: "Alternance ou stage",
  job_etudiant: "Job étudiant",
};

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="panel grid gap-1 rounded-2xl border bg-card p-4">
      <p className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{label}</p>
      <p className="text-3xl font-bold tracking-[-0.04em]">{value}</p>
      {hint ? <p className="text-xs text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="grid gap-3">
      <h2 className="text-lg font-bold tracking-[-0.03em]">{title}</h2>
      {children}
    </section>
  );
}

export function Table({ head, rows }: { head: string[]; rows: ReactNode[][] }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">Rien pour l’instant.</p>;
  }
  return (
    <div className="panel overflow-x-auto rounded-2xl border bg-card">
      <table className="w-full min-w-[42rem] text-left text-sm">
        <thead className="border-b text-xs tracking-wide text-muted-foreground uppercase">
          <tr>
            {head.map((label) => (
              <th key={label} className="px-3 py-2 font-medium">
                {label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((cells, index) => (
            <tr key={index} className="border-b last:border-b-0">
              {cells.map((cell, cellIndex) => (
                <td key={cellIndex} className="px-3 py-2 align-top">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/** Label and value pairs, for one record. */
export function Facts({ items }: { items: [string, ReactNode][] }) {
  return (
    <dl className="panel grid gap-x-6 gap-y-3 rounded-2xl border bg-card p-4 sm:grid-cols-2 lg:grid-cols-3">
      {items.map(([label, value]) => (
        <div key={label} className="grid gap-0.5">
          <dt className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
            {label}
          </dt>
          <dd className="text-sm break-words">{value ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}
