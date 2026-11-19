import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties } from "react";

import {
  ArrowRight,
  ArrowUpRight,
  BellRing,
  BriefcaseBusiness,
  Check,
  Download,
  GraduationCap,
  Heart,
  MapPin,
  PenLine,
  SlidersHorizontal,
  Sparkles,
} from "lucide-react";

import { CvDropzone } from "@/components/cv-dropzone";
import { DropCue } from "@/components/drop-cue";
import { RotatingWord } from "@/components/rotating-word";
import { TrackedLink } from "@/components/tracked-link";
import { EVENTS } from "@/lib/analytics";

export const metadata: Metadata = {
  title: { absolute: "JobGPT · Dépose ton CV, on te trouve ton alternance" },
  description:
    "JobGPT traque les offres d’alternance qui collent à ton profil, te dit lesquelles valent le coup et prépare ta lettre pour chacune.",
};

/**
 * The job boards students already scroll, shown inside a sentence that stays true (C117):
 * "Moins de temps à scroller sur". JobGPT takes no offer from LinkedIn, Indeed or HelloWork
 * and is no partner of theirs, so their logos never stand alone and never sit under a
 * "powered by". `height` is the drawn height in pixels; the files are in public/logos.
 */
const SCROLLED_SITES = [
  { name: "LinkedIn", src: "/logos/linkedin.svg", height: 27 },
  { name: "Indeed", src: "/logos/indeed.svg", height: 30 },
  { name: "HelloWork", src: "/logos/hellowork.svg", height: 21 },
  { name: "France Travail", src: "/logos/france-travail.svg", height: 40 },
] as const;
const SCROLLED_NAMES = SCROLLED_SITES.map((site) => site.name);

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const deleted = params.compte === "supprime";

  return (
    <>
      {/* The sky behind the glass: three slow lights on a fixed layer (C116). */}
      <div className="lp-sky" aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <div className="grain" aria-hidden="true" />

      <header className="site-header">
        <div className="site-bar">
          <a className="brand" href="#top" aria-label="JobGPT, accueil">
            <span className="brand-mark">J</span>
            <span>
              gptjob<span className="brand-tld">.io</span>
            </span>
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
              href="/onboarding/1"
              event={EVENTS.signupClicked}
              properties={{ emplacement: "en-tete" }}
            >
              <span className="cta-long">Trouver mon stage/alternance</span>
              <span className="cta-short" aria-hidden="true">
                Commencer
              </span>
              <ArrowUpRight aria-hidden="true" />
            </TrackedLink>
          </div>
        </div>
      </header>

      <main id="top">
        <section className="hero lp-container">
          {deleted ? (
            <p role="status" className="deleted-notice">
              Votre compte et vos données ont été supprimés.
            </p>
          ) : null}
          <h1 className="enter" data-enter="1">
            Dépose ton CV,
            <br />
            on te trouve ton{" "}
            <span className="hero-word">
              <RotatingWord words={["alternance", "stage"]} suffix="." />
            </span>
          </h1>

          <div className="hero-stage">
            <div className="hero-glow" aria-hidden="true" />
            {/* What a CV gives us, shown as an example around the slab that takes it. */}
            <ul className="hero-chips" aria-hidden="true">
              <li data-chip="level">
                <span className="chip-gem">
                  <GraduationCap />
                </span>
                <span>
                  <small>Niveau</small>
                  <b>Bac+3</b>
                </span>
              </li>
              <li data-chip="job">
                <span className="chip-gem">
                  <BriefcaseBusiness />
                </span>
                <span>
                  <small>Métier</small>
                  <b>Développeur web</b>
                </span>
              </li>
              <li data-chip="city">
                <span className="chip-gem">
                  <MapPin />
                </span>
                <span>
                  <small>Ville</small>
                  <b>Lyon, 30 km autour</b>
                </span>
              </li>
              <li data-chip="match">
                <span className="chip-gem">
                  <Sparkles />
                </span>
                <span>
                  <small>Ensuite</small>
                  <b>Les offres qui collent</b>
                </span>
              </li>
            </ul>
            <div className="hero-drop enter" data-enter="3">
              <DropCue />
              <CvDropzone />
            </div>
          </div>

          <ul className="hero-proof enter" data-enter="4">
            <li>
              <Check aria-hidden="true" /> Des offres réellement publiées
            </li>
            <li>
              <Check aria-hidden="true" /> Rien d’inventé dans ta lettre
            </li>
            <li>
              <Check aria-hidden="true" /> Tu valides chaque envoi
            </li>
          </ul>
        </section>

        <section className="brands lp-container" aria-label="Les sites où tu cherches déjà">
          <p className="sr-only">
            Moins de temps à scroller sur {SCROLLED_NAMES.slice(0, -1).join(", ")} et{" "}
            {SCROLLED_NAMES.at(-1)}.
          </p>
          <div className="brands-band" aria-hidden="true">
            <span className="brands-label">Moins de temps à scroller sur</span>
            <div className="brands-window">
              {/* Two identical halves: the track slides by one half, then starts again. */}
              <ul className="brands-track">
                {[0, 1, 2, 3].flatMap((copy) =>
                  SCROLLED_SITES.map((site) => (
                    <li key={`${copy}-${site.name}`}>
                      {/* A plain image: next/image would refuse or rasterise an SVG logo. */}
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={site.src}
                        alt=""
                        loading="lazy"
                        style={{ "--h": `${site.height}px` } as CSSProperties}
                      />
                    </li>
                  )),
                )}
              </ul>
            </div>
          </div>
        </section>

        <section className="how lp-container" id="comment-ca-marche">
          <div className="section-head">
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
          <ol className="steps">
            <li className="step">
              <div className="step-visual" aria-hidden="true">
                <div className="v-scan">
                  <div className="v-sheet">
                    <i />
                    <i />
                    <i />
                    <i />
                    <i />
                    <span className="v-beam" />
                  </div>
                  <span className="v-tag" data-tag="1">
                    Bac+3
                  </span>
                  <span className="v-tag" data-tag="2">
                    Marketing
                  </span>
                  <span className="v-tag" data-tag="3">
                    Lyon
                  </span>
                </div>
              </div>
              <span className="step-index">1</span>
              <h3>Tu déposes ton CV.</h3>
              <p>
                On y lit ton niveau d’études, ton domaine et ta ville. Pas de CV sous la main ? Cinq
                questions à cliquer font le même travail.
              </p>
            </li>
            <li className="step">
              <div className="step-visual" aria-hidden="true">
                <div className="v-edit">
                  <div className="v-row">
                    <small>Métier</small>
                    <span className="v-pill" data-on>
                      Chef de projet <b>×</b>
                    </span>
                    <span className="v-pill">+</span>
                  </div>
                  <div className="v-row">
                    <small>Niveau</small>
                    <span className="v-seg">
                      <i>Bac+2</i>
                      <i data-on>Bac+3</i>
                      <i>Bac+5</i>
                    </span>
                  </div>
                  <div className="v-row">
                    <small>Rayon</small>
                    <span className="v-slider">
                      <b />
                    </span>
                    <em>30 km</em>
                  </div>
                </div>
              </div>
              <span className="step-index">2</span>
              <h3>Tu corriges en deux clics.</h3>
              <p>
                Ce qu’on a lu s’affiche : métiers, niveau, ville. Tu ajustes si besoin, et la
                recherche part. Ensuite on la relance pour toi plusieurs fois par jour.
              </p>
            </li>
            <li className="step">
              <div className="step-visual" aria-hidden="true">
                <div className="v-offer">
                  <div className="v-offer-top">
                    <span className="v-logo">N</span>
                    <span>
                      <b>Assistant marketing</b>
                      <small>Atelier Nova, Lyon</small>
                    </span>
                    <span className="v-match">97 %</span>
                  </div>
                  <div className="v-offer-line">
                    <PenLine /> Lettre adaptée, prête à partir
                  </div>
                  <div className="v-offer-line">
                    <BellRing /> Relance conseillée dans 5 jours
                  </div>
                </div>
              </div>
              <span className="step-index">3</span>
              <h3>Tu frappes en premier.</h3>
              <p>
                Une sélection courte, une lettre déjà adaptée à l’entreprise, et le suivi de tes
                réponses. Tu postules quand ça compte.
              </p>
            </li>
          </ol>
        </section>

        <section className="feed lp-container" id="offres">
          <div className="feed-copy">
            <h2>
              Le feed qui ne te fait <em>pas perdre ton temps.</em>
            </h2>
            <p>
              Chaque offre est confrontée à ton profil : métier, distance, niveau, fraîcheur, mots
              de ton CV. Contrat, début, durée, télétravail : tu vois l’essentiel en trois secondes,
              pas en trois clics.
            </p>
            <ul className="check-list">
              <li>
                <span>
                  <Check aria-hidden="true" />
                </span>
                Des offres vivantes, retirées dès qu’elles expirent
              </li>
              <li>
                <span>
                  <Check aria-hidden="true" />
                </span>
                Un score de compatibilité qui s’explique
              </li>
              <li>
                <span>
                  <Check aria-hidden="true" />
                </span>
                Une lettre réécrite pour chaque entreprise
              </li>
            </ul>
            <TrackedLink
              className="button-ink"
              href="/onboarding/1"
              event={EVENTS.signupClicked}
              properties={{ emplacement: "offres" }}
            >
              Voir mes offres <ArrowRight aria-hidden="true" />
            </TrackedLink>
          </div>

          <div className="feed-stage" aria-hidden="true">
            <div className="feed-glow" />
            <div className="feed-demo">
              <div className="feed-head">
                <span className="feed-who">
                  <i>C</i> Pour Clara
                </span>
                <span className="feed-filter">
                  <SlidersHorizontal /> Filtres
                </span>
              </div>
              <div className="feed-status">
                <span>12 offres pour toi</span>
                <span>Triées par pertinence</span>
              </div>
              <article className="job">
                <div className="job-top">
                  <span className="job-logo" data-tone="ember">
                    N
                  </span>
                  <span className="job-company">
                    <strong>Atelier Nova</strong>
                    <small>Studio produit, 40 salariés</small>
                  </span>
                  <Heart className="job-heart" />
                </div>
                <h3>Product Marketing Manager, alternance</h3>
                <div className="job-meta">
                  <span>Paris, hybride</span>
                  <span>Sept. 2026</span>
                  <span>12 mois</span>
                </div>
                <div className="job-foot">
                  <span className="job-match">
                    <Sparkles /> 97 % de correspondance
                  </span>
                  <span>il y a 3 heures</span>
                </div>
              </article>
              <article className="job" data-dim>
                <div className="job-top">
                  <span className="job-logo" data-tone="ink">
                    L
                  </span>
                  <span className="job-company">
                    <strong>Lumen</strong>
                    <small>Fintech, 120 salariés</small>
                  </span>
                  <Heart className="job-heart" />
                </div>
                <h3>Chargé·e de communication, alternance</h3>
                <div className="job-foot">
                  <span className="job-match" data-soft>
                    <Sparkles /> 93 % de correspondance
                  </span>
                  <span>il y a 6 heures</span>
                </div>
              </article>
              <p className="feed-caption">Exemple d’affichage, entreprises fictives.</p>
            </div>
            <div className="feed-why">
              <b>Pourquoi ce match ?</b>
              Ton métier, ta ville et ton CV sont alignés.
            </div>
          </div>
        </section>

        <section className="pledges lp-container" id="engagements">
          <div className="section-head">
            <h2>
              Zéro blabla.
              <br />
              <em>Que du concret.</em>
            </h2>
            <p>Ce qu’on promet ici, tu le retrouves tel quel dans le produit.</p>
          </div>
          <div className="bento">
            <article className="pledge" data-pledge="letter">
              <div className="letter-demo" aria-hidden="true">
                <span className="letter-head">
                  Lettre de motivation <b>Atelier Nova</b>
                </span>
                <p>
                  … c’est pourquoi je souhaite rejoindre <del>votre entreprise</del>{" "}
                  <ins>Atelier Nova</ins> et <del>ce poste</del>{" "}
                  <ins>le poste d’assistant marketing</ins> dès septembre.
                </p>
                <span className="letter-note">
                  <PenLine /> 2 passages adaptés, montrés un par un
                </span>
              </div>
              <h3>Ta lettre reste la tienne.</h3>
              <p>
                JobGPT l’adapte à chaque entreprise sans rien inventer, et te montre chaque mot
                changé.
              </p>
            </article>
            <article className="pledge" data-pledge="follow">
              <ol className="follow-line" aria-hidden="true">
                <li data-done>
                  <i />
                  Envoyée
                </li>
                <li data-now>
                  <i />
                  Relance à 5 jours
                </li>
                <li>
                  <i />
                  Réponse
                </li>
              </ol>
              <h3>Aucune candidature oubliée.</h3>
              <p>
                Tu candidates sur le site de l’offre, puis JobGPT suit tes réponses et te sonne
                quand il faut relancer.
              </p>
            </article>
            <article className="pledge" data-pledge="stat">
              <strong>100 %</strong>
              <p>des changements apportés à ta lettre te sont montrés, un par un.</p>
            </article>
            <article className="pledge" data-pledge="data">
              <span className="pledge-gem" aria-hidden="true">
                <Download />
              </span>
              <h3>Tes données t’appartiennent.</h3>
              <p>
                Tu exportes tout en un clic et tu supprimes ton compte quand tu veux. La suppression
                est réelle.
              </p>
            </article>
          </div>
        </section>

        <section className="final lp-container">
          <div className="final-slab">
            <div className="final-orbs" aria-hidden="true" />
            <p className="final-live">
              <span className="pulse" /> Les offres de la rentrée sont en ligne
            </p>
            <h2>
              Les bonnes offres
              <br />
              partent <em>vite.</em>
            </h2>
            <p className="final-copy">
              Pendant que tu hésites, quelqu’un d’autre envoie sa candidature.
            </p>
            <div className="final-actions">
              <TrackedLink
                className="shiny-cta"
                href="/onboarding/1"
                event={EVENTS.signupClicked}
                properties={{ emplacement: "final" }}
              >
                <span>
                  Prendre une longueur d’avance <ArrowRight aria-hidden="true" />
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
          <span className="brand-mark">J</span>
          <span>
            gptjob<span className="brand-tld">.io</span>
          </span>
        </a>
        <p>© 2026 JobGPT. Cherche moins. Décroche plus.</p>
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
