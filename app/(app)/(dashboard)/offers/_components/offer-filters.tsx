import { Button } from "@/components/ui/button";

export type OfferFilterValues = { maxKm: string; days: string; company: string; view: string };

const control =
  "h-9 rounded-full border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/** Plain GET form: filters live in the URL and work without JavaScript. */
export function OfferFilters({ values }: { values: OfferFilterValues }) {
  return (
    <form
      method="get"
      className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-3 text-sm sm:p-4"
    >
      <label className="grid gap-1">
        <span className="text-muted-foreground">Distance</span>
        <select name="km" defaultValue={values.maxKm} className={control}>
          <option value="">Tout le rayon</option>
          <option value="10">10 km</option>
          <option value="20">20 km</option>
          <option value="30">30 km</option>
          <option value="50">50 km</option>
        </select>
      </label>
      <label className="grid gap-1">
        <span className="text-muted-foreground">Publiée</span>
        <select name="days" defaultValue={values.days} className={control}>
          <option value="">Toutes les dates</option>
          <option value="7">Moins de 7 jours</option>
          <option value="30">Moins de 30 jours</option>
        </select>
      </label>
      <label className="grid gap-1">
        <span className="text-muted-foreground">Entreprise</span>
        <input name="company" defaultValue={values.company} className={control} placeholder="Nom" />
      </label>
      <label className="grid gap-1">
        <span className="text-muted-foreground">Afficher</span>
        <select name="view" defaultValue={values.view} className={control}>
          <option value="">Toutes les offres</option>
          <option value="saved">Offres enregistrées</option>
        </select>
      </label>
      <Button type="submit" variant="outline" size="sm">
        Filtrer
      </Button>
    </form>
  );
}
