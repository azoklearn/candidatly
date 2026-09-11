import type { ReactNode } from "react";

/** Readable layout for the legal pages, without a typography plugin. */
export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: ReactNode;
}) {
  return (
    <main className="mx-auto grid w-full max-w-3xl gap-6 px-6 py-12 text-sm leading-relaxed [&_h2]:mt-4 [&_h2]:text-lg [&_h2]:font-semibold [&_h2]:tracking-tight [&_li]:ml-5 [&_li]:list-disc [&_a]:underline [&_a]:underline-offset-4">
      <header className="grid gap-1">
        <h1 className="text-3xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground">Dernière mise à jour : {updated}</p>
      </header>
      {children}
    </main>
  );
}
