import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { buttonVariants } from "@/components/ui/button";
import { findGuide, GUIDES } from "@/lib/guides/guides";

type Params = Promise<{ slug: string }>;

export function generateStaticParams() {
  return GUIDES.map((guide) => ({ slug: guide.slug }));
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const guide = findGuide((await params).slug);
  if (!guide) return {};
  return {
    title: guide.title,
    description: guide.description,
    alternates: { canonical: `/guides/${guide.slug}` },
  };
}

/** One public guide (docs/QUESTIONS.md C122): the text lives in lib/guides/guides.ts. */
export default async function GuidePage({ params }: { params: Params }) {
  const guide = findGuide((await params).slug);
  if (!guide) notFound();
  const others = GUIDES.filter((item) => item.slug !== guide.slug);

  return (
    <main className="mx-auto grid w-full max-w-3xl gap-10 px-4 py-14 sm:px-6">
      <header className="fade-up grid gap-4">
        <Link
          href="/guides"
          className="w-fit text-sm text-muted-foreground underline underline-offset-4"
        >
          Tous les guides
        </Link>
        <h1 className="page-title">{guide.title}</h1>
        <p className="text-lg text-muted-foreground">{guide.intro}</p>
      </header>

      <article className="grid gap-8">
        {guide.sections.map((section) => (
          <section key={section.heading} className="grid gap-3">
            <h2 className="section-title">{section.heading}</h2>
            {section.paragraphs.map((paragraph) => (
              <p key={paragraph} className="leading-relaxed text-foreground/85">
                {paragraph}
              </p>
            ))}
            {section.list ? (
              <ul className="grid gap-2">
                {section.list.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-3 leading-relaxed text-foreground/85"
                  >
                    <span
                      aria-hidden
                      className="plan-badge mt-1.5 grid size-2 shrink-0 rounded-full"
                    />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            ) : null}
          </section>
        ))}
        {guide.sources ? (
          <p className="text-sm text-muted-foreground">
            Sources :{" "}
            {guide.sources.map((source, index) => (
              <span key={source.href}>
                {index > 0 ? ", " : ""}
                <a
                  href={source.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="underline underline-offset-4"
                >
                  {source.label}
                </a>
              </span>
            ))}
            .
          </p>
        ) : null}
      </article>

      <div className="panel-tint grid justify-items-start gap-4 rounded-3xl border p-7">
        <p className="section-title">
          Passe à <em>la pratique</em>
        </p>
        <Link href={guide.next.href} className={buttonVariants({ variant: "shiny", size: "lg" })}>
          {guide.next.label}
        </Link>
      </div>

      <nav aria-label="Autres guides" className="grid gap-3">
        <h2 className="text-sm font-semibold text-muted-foreground">À lire aussi</h2>
        <ul className="grid gap-2">
          {others.map((item) => (
            <li key={item.slug}>
              <Link
                href={`/guides/${item.slug}`}
                className="font-semibold underline-offset-4 hover:text-brand hover:underline"
              >
                {item.title}
              </Link>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
}
