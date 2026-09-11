import { Tag } from "@/components/tag";
import { TrackedLink } from "@/components/tracked-link";
import { buttonVariants } from "@/components/ui/button";
import { EVENTS } from "@/lib/analytics";
import { formatDistance } from "@/lib/format";
import type { HiringCompanyCardData } from "@/lib/offers/hiring-companies";

/** A company likely to hire apprentices, reached by an unsolicited application. */
export function HiringCompanyCard({ company }: { company: HiringCompanyCardData }) {
  const place = [
    company.city,
    company.distanceKm === null ? null : formatDistance(company.distanceKm),
  ].filter(Boolean);

  return (
    <li className="card-lift grid content-start gap-3 rounded-2xl border bg-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="grid size-10 shrink-0 place-items-center rounded-xl bg-secondary text-base font-bold text-foreground"
        >
          {company.name.slice(0, 1).toUpperCase()}
        </span>
        <div className="grid min-w-0 gap-0.5">
          <p className="leading-snug font-semibold tracking-[-0.02em]">{company.name}</p>
          {place.length > 0 ? (
            <p className="text-sm text-muted-foreground">{place.join(" · ")}</p>
          ) : null}
        </div>
      </div>
      <div className="flex flex-wrap gap-2">
        <span className="match-pill">✦ Fort potentiel d’embauche</span>
        {company.sector ? <Tag>{company.sector}</Tag> : null}
        {company.headcount ? <Tag>{company.headcount}</Tag> : null}
      </div>
      {company.applyUrl ? (
        <TrackedLink
          href={company.applyUrl}
          event={EVENTS.spontaneousApplication}
          className={`${buttonVariants({ variant: "outline", size: "sm" })} w-fit`}
        >
          Envoyer une candidature spontanée <span aria-hidden>↗</span>
        </TrackedLink>
      ) : null}
    </li>
  );
}
