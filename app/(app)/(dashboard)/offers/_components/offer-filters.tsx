"use client";

import { useRouter } from "next/navigation";
import { useTransition, type ChangeEvent, type FormEvent } from "react";

import { Button } from "@/components/ui/button";

export type OfferFilterValues = { maxKm: string; days: string; company: string; view: string };

const control =
  "h-9 rounded-full border border-input bg-background px-3 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50";

/**
 * Filters live in the URL, so the form stays a plain GET and keeps working without
 * JavaScript. With JavaScript, picking a value applies it straight away and the bar says
 * that something is loading: the page used to change under the student with no warning.
 */
export function OfferFilters({ values }: { values: OfferFilterValues }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const apply = (form: HTMLFormElement) => {
    const query = new URLSearchParams();
    for (const [name, value] of new FormData(form)) {
      if (typeof value === "string" && value.trim() !== "") query.set(name, value.trim());
    }
    const search = query.toString();
    startTransition(() => router.push(search ? `/offers?${search}` : "/offers", { scroll: false }));
  };

  const onSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    apply(event.currentTarget);
  };

  // A chosen value applies itself; free text waits for the button, to avoid a query per key.
  const onChange = (event: ChangeEvent<HTMLFormElement>) => {
    if (event.target instanceof HTMLSelectElement) apply(event.currentTarget);
  };

  return (
    <form
      method="get"
      onSubmit={onSubmit}
      onChange={onChange}
      aria-busy={pending}
      className="relative flex flex-wrap items-end gap-3 overflow-hidden rounded-2xl border bg-card p-3 text-sm sm:p-4"
    >
      {pending ? (
        <span
          aria-hidden
          className="loader-bar absolute inset-x-0 top-0 h-[3px] w-full rounded-none bg-transparent"
        />
      ) : null}
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
      <Button type="submit" variant="outline" size="sm" disabled={pending}>
        {pending ? "Filtrage…" : "Filtrer"}
      </Button>
    </form>
  );
}
