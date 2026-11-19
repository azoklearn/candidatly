import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";

import { GUIDES } from "@/lib/guides/guides";

export const metadata: Metadata = {
  title: "Guides alternance et stage",
  description:
    "Des guides courts pour trouver une alternance ou un stage : méthode de recherche, lettre de motivation, candidature spontanée, salaire.",
  alternates: { canonical: "/guides" },
};

export default function GuidesPage() {
  return (
    <main className="mx-auto grid w-full max-w-4xl gap-10 px-4 py-14 sm:px-6">
      <header className="fade-up grid gap-3">
        <h1 className="page-title">
          Les guides <em>JobGPT</em>
        </h1>
        <p className="max-w-2xl text-muted-foreground">
          Courts, concrets, sans promesse miracle : ce qu’il faut savoir pour chercher une
          alternance ou un stage.
        </p>
      </header>
      <ul className="grid gap-4 sm:grid-cols-2">
        {GUIDES.map((guide, index) => (
          <li key={guide.slug} style={{ "--i": index } as CSSProperties} className="rise">
            <Link
              href={`/guides/${guide.slug}`}
              className="card-lift panel grid h-full content-start gap-2 rounded-3xl border bg-card p-6"
            >
              <h2 className="font-heading text-xl leading-tight font-semibold tracking-[-0.03em]">
                {guide.title}
              </h2>
              <p className="text-sm text-muted-foreground">{guide.intro}</p>
              <span className="mt-2 text-sm font-semibold text-brand">Lire le guide</span>
            </Link>
          </li>
        ))}
        <li className="rise" style={{ "--i": GUIDES.length } as CSSProperties}>
          <Link
            href="/outils/salaire-alternance"
            className="card-lift panel-warm grid h-full content-start gap-2 rounded-3xl border p-6"
          >
            <h2 className="font-heading text-xl leading-tight font-semibold tracking-[-0.03em]">
              Simulateur de salaire en alternance
            </h2>
            <p className="text-sm text-muted-foreground">
              Ton minimum légal selon ton contrat, ton âge et ton année, en trois clics.
            </p>
            <span className="mt-2 text-sm font-semibold text-brand">Ouvrir le simulateur</span>
          </Link>
        </li>
      </ul>
    </main>
  );
}
