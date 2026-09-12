import { Tag } from "@/components/tag";
import type { TeaserCard } from "@/lib/offers/teaser";

/**
 * Preview of the matches before payment (C88). The blurred bars are empty: the job titles
 * and the employers never reach the browser, so removing the blur in the developer tools
 * reveals nothing.
 */
export function OfferTeaser({ cards }: { cards: TeaserCard[] }) {
  if (cards.length === 0) return null;
  return (
    <section aria-labelledby="apercu" className="fade-up grid gap-4">
      <div className="grid justify-items-center gap-1 text-center">
        <p className="eyebrow">Aperçu</p>
        <h2 id="apercu" className="section-title">
          Vos offres attendent <em>derrière le flou</em>
        </h2>
        <p className="max-w-xl text-sm text-muted-foreground">
          Ville, contrat, fraîcheur et correspondance sont visibles. Les intitulés et les employeurs
          s’affichent avec votre forfait.
        </p>
      </div>
      <ul className="grid gap-3 sm:grid-cols-2">
        {cards.map((card, index) => (
          <li key={index} className="grid gap-3 rounded-2xl border bg-card p-4">
            <div className="grid gap-2">
              <span className="teaser-bar w-4/5" aria-hidden />
              <span className="teaser-bar teaser-bar-small w-1/2" aria-hidden />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <span className="match-pill">✦ {card.score} %</span>
              {card.city ? <Tag>{card.city}</Tag> : null}
              <Tag>{card.contract}</Tag>
              {card.freshness ? <Tag>{card.freshness}</Tag> : null}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
