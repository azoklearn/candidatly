import type { Metadata } from "next";
import Link from "next/link";

import { TrackedLink } from "@/components/tracked-link";
import { EVENTS } from "@/lib/analytics";
import { socialProofMessage, type LandingStats } from "@/lib/social-proof";
import { createAdminClient } from "@/lib/supabase/admin";

export const metadata: Metadata = {
  title: { absolute: "Candidatly · Ta prochaine opportunité t’attend" },
  description:
    "Candidatly trouve les stages et alternances qui te ressemblent et prépare ta lettre de motivation pour chacune.",
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
              Ton futur poste
              <br />
              ne devrait pas dépendre
              <br />
              d’un <em>coup de chance.</em>
            </h1>
            <p className="hero-copy">
              Candidatly trie pour toi les offres de stage et d’alternance, ne te montre que celles
              qui cochent vraiment tes cases et prépare ta lettre pour chacune.
            </p>
            <div className="hero-actions">
              <TrackedLink
                className="shiny-cta"
                href="/signup"
                event={EVENTS.signupClicked}
                properties={{ emplacement: "hero" }}
              >
                <span>
                  Trouver mon opportunité <b>→</b>
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
              Moins de recherches.
              <br />
              <em>Plus de réponses.</em>
            </h2>
            <p>
              Quelques minutes pour nous dire ce que tu cherches. Ensuite, Candidatly fait le tri,
              avec exigence.
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
              <h3>Tu poses ton cap.</h3>
              <p>
                Ta formation, ton niveau, les métiers visés, ta ville. Un profil qui va au-delà de
                trois mots-clés.
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
              <h3>On garde l’œil ouvert.</h3>
              <p>
                Candidatly suit les offres publiées sur La bonne alternance et ses partenaires,
                mises à jour plusieurs fois par jour.
              </p>
              <span className="step-arrow">↘</span>
            </article>
            <article className="step-card dark-card reveal reveal-delay-2">
              <span className="step-index">03</span>
              <div className="step-icon spark-icon">✦</div>
              <h3>Tu candidates au bon moment.</h3>
              <p>
                Une sélection nette et une lettre adaptée à chaque offre. Tu candidates, puis tu
                suis tes réponses.
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
                Le feed qui
                <br />
                <em>connaît tes critères.</em>
              </h2>
              <p>
                Chaque offre est comparée à ton profil : métier, distance, niveau, fraîcheur et mots
                de ton CV. Contrat, date de début, durée, télétravail : tu vois l’essentiel, tout de
                suite.
              </p>
              <ul className="check-list">
                <li>
                  <span>✓</span> Des offres à jour, retirées dès qu’elles expirent
                </li>
                <li>
                  <span>✓</span> Un score de compatibilité transparent
                </li>
                <li>
                  <span>✓</span> Une lettre adaptée à chaque offre
                </li>
              </ul>
              <TrackedLink
                className="button button-dark"
                href="/signup"
                event={EVENTS.signupClicked}
                properties={{ emplacement: "offres" }}
              >
                Découvrir Candidatly <span>→</span>
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
              Le moment où
              <br />
              <em>tout s’aligne.</em>
            </h2>
            <div className="rating">
              <span>✦</span> Offres : La bonne alternance · Entreprises : Annuaire des Entreprises
            </div>
          </div>
          <div className="quote-layout">
            <article className="quote quote-main reveal">
              <span className="quote-mark">“</span>
              <blockquote>
                Ta lettre reste la tienne. Candidatly l’adapte à chaque offre sans rien inventer, et
                te montre chaque changement.
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
                  propose une relance au bon moment.
                </blockquote>
                <footer>
                  <span className="person-avatar violet">✓</span>
                  <span>
                    <strong>Un suivi sans oubli</strong>
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
              Ton prochain “oui”
              <br />
              commence <em>ici.</em>
            </h2>
            <p>Rejoins les étudiants qui refusent de laisser leur avenir au hasard.</p>
            <div className="final-actions">
              <TrackedLink
                className="shiny-cta"
                href="/signup"
                event={EVENTS.signupClicked}
                properties={{ emplacement: "final" }}
              >
                <span>
                  Trouver les offres qui me correspondent <b>→</b>
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
        <p>© 2026 Candidatly. Cherche moins. Choisis mieux.</p>
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
