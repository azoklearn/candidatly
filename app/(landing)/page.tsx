import type { Metadata } from "next";
import Link from "next/link";

import { RotatingWord } from "@/components/rotating-word";
import { TrackedLink } from "@/components/tracked-link";
import { EVENTS } from "@/lib/analytics";
import { socialProofMessage, type LandingStats } from "@/lib/social-proof";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: { absolute: "Candidatly · Trouve ton alternance en quelques clics" },
  description:
    "Candidatly traque les offres d’alternance qui collent à ton profil, te dit lesquelles valent le coup et prépare ta lettre pour chacune.",
};

/** Real numbers for the proof pill; none when the database is unreachable. */
async function loadStats(): Promise<LandingStats | null> {
  try {
    const admin = createAdminClient();
    const [placed, students] = await Promise.all([
      admin.from("applications").select("user_id").eq("status", "replied_positive").limit(10_000),
      admin
        .from("profiles")
        .select("user_id", { count: "exact", head: true })
        .eq("onboarding_completed", true),
    ]);
    if (placed.error || students.error) return null;
    return {
      placedStudents: new Set(placed.data.map((row) => row.user_id)).size,
      students: students.count ?? 0,
    };
  } catch {
    return null;
  }
}

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const [params, stats] = await Promise.all([searchParams, loadStats()]);
  const deleted = params.compte === "supprime";
  const proof = socialProofMessage(stats);

  return (
    <>
      <div className="grain" aria-hidden="true" />

      <header className="site-header lp-container">
        <a className="brand" href="#top" aria-label="Candidatly, accueil">
          <span className="brand-mark">C</span>
          <span>Candidatly</span>
        </a>
        <nav aria-label="Navigation principale">
          <a href="#comment-ca-marche">Comment ça marche</a>
          <a href="#offres">Les offres</a>
          <a href="#engagements">Nos engagements</a>
          <Link href="/tarifs">Tarifs</Link>
        </nav>
        <div className="header-actions">
          <Link className="header-login" href="/login">
            Se connecter
          </Link>
          <TrackedLink
            className="header-cta"
            href="/signup"
            event={EVENTS.signupClicked}
            properties={{ emplacement: "en-tete" }}
          >
            Trouver mon stage/alternance <span>↗</span>
          </TrackedLink>
        </div>
      </header>

      <main id="top">
        <section className="hero lp-container">
          <div className="hero-intro reveal">
            {deleted ? (
              <p role="status" className="deleted-notice">
                Votre compte et vos données ont été supprimés.
              </p>
            ) : null}
            <div className="social-proof-pill">
              <span className="hero-stars" aria-hidden="true">
                ✦
              </span>
              <span>{proof}</span>
            </div>
            <h1>
              Trouve ton <RotatingWord words={["alternance", "stage"]} />
              <br />
              en quelques <em>clics.</em>
            </h1>
            <p className="hero-copy">
              Des offres d’alternance sortent tous les jours et disparaissent aussi vite. Candidatly
              garde celles qui collent à ton profil, te dit pourquoi, et prépare ta lettre pendant
              que les autres recopient la leur.
            </p>
            <div className="hero-actions">
              <TrackedLink
                className="shiny-cta"
                href="/signup"
                event={EVENTS.signupClicked}
                properties={{ emplacement: "hero" }}
              >
                <span>
                  Décrocher mon alternance <b>→</b>
                </span>
              </TrackedLink>
              <a className="text-link" href="#comment-ca-marche">
                Voir comment ça marche <span>↓</span>
              </a>
            </div>
          </div>
        </section>

        <section className="how lp-container" id="comment-ca-marche">
          <div className="section-heading reveal">
            <span className="section-number">01 — LA MÉTHODE</span>
            <h2>
              Deux minutes pour toi.
              <br />
              <em>Le tri, c’est nous.</em>
            </h2>
            <p>
              Tu dis ce que tu vises une seule fois. Ensuite, tu ne vois plus que les offres qui
              méritent ton temps.
            </p>
          </div>
          <div className="steps">
            <article className="step-card reveal">
              <span className="step-index">01</span>
              <div className="step-icon profile-icon">
                <i />
                <i />
                <i />
              </div>
              <h3>Tu dis ce que tu vises.</h3>
              <p>
                Ta formation, ton niveau, les métiers, ta ville. Un profil qui va plus loin que
                trois mots-clés jetés dans une barre de recherche.
              </p>
              <span className="step-arrow">↘</span>
            </article>
            <article className="step-card yellow-card reveal reveal-delay">
              <span className="step-index">02</span>
              <div className="step-icon radar-icon">
                <i />
                <i />
                <i />
              </div>
              <h3>On surveille pendant que tu bosses.</h3>
              <p>
                Les offres publiées sur La bonne alternance et ses partenaires, suivies pour toi
                plusieurs fois par jour. Zéro onglet à garder ouvert.
              </p>
              <span className="step-arrow">↘</span>
            </article>
            <article className="step-card dark-card reveal reveal-delay-2">
              <span className="step-index">03</span>
              <div className="step-icon spark-icon">✦</div>
              <h3>Tu frappes en premier.</h3>
              <p>
                Une sélection courte, une lettre déjà adaptée à l’entreprise, et le suivi de tes
                réponses. Tu postules quand ça compte.
              </p>
              <span className="step-arrow">↘</span>
            </article>
          </div>
        </section>

        <section className="opportunity-section" id="offres">
          <div className="lp-container opportunity-grid">
            <div className="opportunity-copy reveal">
              <span className="section-number">02 — PAS JUSTE DES ANNONCES</span>
              <h2>
                Le feed qui ne te fait
                <br />
                <em>pas perdre ton temps.</em>
              </h2>
              <p>
                Chaque offre est confrontée à ton profil : métier, distance, niveau, fraîcheur, mots
                de ton CV. Contrat, début, durée, télétravail : tu vois l’essentiel en trois
                secondes, pas en trois clics.
              </p>
              <ul className="check-list">
                <li>
                  <span>✓</span> Des offres vivantes, retirées dès qu’elles expirent
                </li>
                <li>
                  <span>✓</span> Un score de compatibilité qui s’explique
                </li>
                <li>
                  <span>✓</span> Une lettre réécrite pour chaque entreprise
                </li>
              </ul>
              <TrackedLink
                className="button button-dark"
                href="/signup"
                event={EVENTS.signupClicked}
                properties={{ emplacement: "offres" }}
              >
                Voir mes offres <span>→</span>
              </TrackedLink>
            </div>
            <div className="feed-demo reveal reveal-delay">
              <div className="feed-head">
                <span>
                  Pour Clara <b>⌄</b>
                </span>
                <button type="button" tabIndex={-1} aria-hidden="true">
                  ☷ Filtres
                </button>
              </div>
              <div className="feed-status">
                <span>12 offres pour toi</span>
                <span>
                  Triées par pertinence <b>↕</b>
                </span>
              </div>
              <article className="wide-job">
                <div className="wide-job-top">
                  <div className="company">
                    <span className="company-symbol company-blue">N</span>
                    <div>
                      <strong>Atelier Nova</strong>
                      <small>Studio produit · 40 salariés</small>
                    </div>
                  </div>
                  <span className="heart">♡</span>
                </div>
                <h3>
                  Product Marketing Manager <em>— Alternance</em>
                </h3>
                <div className="wide-meta">
                  <span>Paris · hybride</span>
                  <span>Sept. 2026</span>
                  <span>12 mois</span>
                </div>
                <div className="wide-footer">
                  <span className="match-pill">✦ 97% match</span>
                  <span>il y a 3 heures</span>
                </div>
              </article>
              <article className="wide-job dimmed">
                <div className="wide-job-top">
                  <div className="company">
                    <span className="company-symbol company-navy">L</span>
                    <div>
                      <strong>Lumen</strong>
                      <small>Fintech · 120 salariés</small>
                    </div>
                  </div>
                  <span className="heart">♡</span>
                </div>
                <h3>
                  Chargé·e de communication <em>— Alternance</em>
                </h3>
                <div className="wide-footer">
                  <span className="match-pill soft-match">✦ 93% match</span>
                  <span>il y a 6 heures</span>
                </div>
              </article>
              <p className="feed-caption">Exemple d’affichage, entreprises fictives.</p>
              <div className="cursor-note">
                <span className="cursor">↖</span>
                <p>
                  <b>Pourquoi ce match ?</b>
                  <br />
                  Ton métier, ta ville
                  <br />
                  et ton CV sont alignés.
                </p>
              </div>
            </div>
          </div>
        </section>

        <section className="testimonials lp-container" id="engagements">
          <div className="testimonial-header reveal">
            <span className="section-number">03 — NOS ENGAGEMENTS</span>
            <h2>
              Zéro blabla.
              <br />
              <em>Que du concret.</em>
            </h2>
            <div className="rating">
              <span>✦</span> Offres : La bonne alternance · Entreprises : Annuaire des Entreprises
            </div>
          </div>
          <div className="quote-layout">
            <article className="quote quote-main reveal">
              <span className="quote-mark">“</span>
              <blockquote>
                Ta lettre reste la tienne. Candidatly l’adapte à chaque entreprise sans rien
                inventer, et te montre chaque mot changé.
              </blockquote>
              <footer>
                <span className="person-avatar coral">✦</span>
                <span>
                  <strong>Notre engagement</strong>
                  <small>Rien d’inventé, jamais</small>
                </span>
                <b>C</b>
              </footer>
            </article>
            <div className="quote-column">
              <article className="quote quote-small reveal reveal-delay">
                <blockquote>
                  Tu candidates sur le site de l’offre, puis Candidatly suit tes réponses et te
                  sonne quand il faut relancer.
                </blockquote>
                <footer>
                  <span className="person-avatar violet">✓</span>
                  <span>
                    <strong>Aucune candidature oubliée</strong>
                    <small>Relance conseillée après 5 jours</small>
                  </span>
                </footer>
              </article>
              <article className="quote-stat reveal reveal-delay-2">
                <strong>100 %</strong>
                <p>des changements apportés à ta lettre te sont montrés, un par un.</p>
                <span>✦</span>
              </article>
            </div>
          </div>
        </section>

        <section className="final-cta">
          <div className="final-dots" aria-hidden="true" />
          <div className="lp-container final-inner reveal">
            <span className="eyebrow light">
              <span className="pulse" /> LES OFFRES DE LA RENTRÉE SONT EN LIGNE
            </span>
            <h2>
              Les bonnes offres
              <br />
              partent <em>vite.</em>
            </h2>
            <p>Pendant que tu hésites, quelqu’un d’autre envoie sa candidature.</p>
            <div className="final-actions">
              <TrackedLink
                className="shiny-cta"
                href="/signup"
                event={EVENTS.signupClicked}
                properties={{ emplacement: "final" }}
              >
                <span>
                  Prendre une longueur d’avance <b>→</b>
                </span>
              </TrackedLink>
              <Link className="final-login" href="/login">
                Déjà inscrit ? Se connecter
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="site-footer lp-container">
        <a className="brand" href="#top">
          <span className="brand-mark">C</span>
          <span>Candidatly</span>
        </a>
        <p>© 2026 Candidatly. Cherche moins. Décroche plus.</p>
        <div>
          <Link href="/mentions-legales">Mentions légales</Link>
          <Link href="/confidentialite">Confidentialité</Link>
          <Link href="/conditions">Conditions d’utilisation</Link>
          <Link href="/tarifs">Tarifs</Link>
        </div>
      </footer>
    </>
  );
}
