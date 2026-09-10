"use client";

import { useActionState, useRef, useState } from "react";
import { z } from "zod";

import { ActionForm } from "@/components/action-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { saveLocation, type FormState } from "../actions";
import { FieldHint, selectClassName } from "./fields";

const PlaceSchema = z.object({
  label: z.string(),
  citycode: z.string().nullable(),
  context: z.string().nullable(),
  type: z.string(),
});
const ResponseSchema = z.object({ places: z.array(PlaceSchema) });
type Place = z.infer<typeof PlaceSchema>;

const RADIUS_OPTIONS = [10, 20, 30, 50, 100] as const;
const DEBOUNCE_MS = 300;

export function LocationStep({
  initialLabel,
  initialCitycode,
  initialRadius,
}: {
  initialLabel: string | null;
  initialCitycode: string | null;
  initialRadius: number;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveLocation, {});
  const [query, setQuery] = useState(initialLabel ?? "");
  const [places, setPlaces] = useState<Place[]>([]);
  const [chosen, setChosen] = useState<{ label: string; citycode: string } | null>(
    initialLabel && initialCitycode ? { label: initialLabel, citycode: initialCitycode } : null,
  );
  const [searching, setSearching] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controller = useRef<AbortController | null>(null);

  function onQueryChange(value: string) {
    setQuery(value);
    setChosen(null);
    if (timer.current) clearTimeout(timer.current);
    if (value.trim().length < 3) {
      setPlaces([]);
      return;
    }
    timer.current = setTimeout(async () => {
      controller.current?.abort();
      controller.current = new AbortController();
      setSearching(true);
      try {
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(value.trim())}`, {
          signal: controller.current.signal,
        });
        const parsed = ResponseSchema.safeParse(await response.json());
        setPlaces(parsed.success ? parsed.data.places : []);
      } catch {
        // Aborted or network error: keep the previous suggestions.
      } finally {
        setSearching(false);
      }
    }, DEBOUNCE_MS);
  }

  const radiusDefault = (RADIUS_OPTIONS as readonly number[]).includes(initialRadius)
    ? initialRadius
    : 30;

  return (
    <ActionForm action={action} className="grid gap-5">
      <div className="grid gap-2">
        <Label htmlFor="place">Ville ou adresse autour de laquelle chercher</Label>
        <Input
          id="place"
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          autoComplete="off"
          aria-describedby="place-status"
          placeholder="Par exemple : Lyon, ou 10 rue de la République, Lyon"
        />
        <p id="place-status" className="text-sm text-muted-foreground" aria-live="polite">
          {chosen
            ? `Adresse retenue : ${chosen.label}`
            : searching
              ? "Recherche…"
              : "Tapez au moins 3 caractères."}
        </p>
        {places.length > 0 && !chosen ? (
          <ul className="grid gap-1 rounded-lg border p-1">
            {places.map((place) => (
              <li key={`${place.label}-${place.citycode}`}>
                <button
                  type="button"
                  className="w-full rounded-md px-2 py-1.5 text-left text-sm hover:bg-muted"
                  disabled={!place.citycode}
                  onClick={() => {
                    if (!place.citycode) return;
                    setChosen({ label: place.label, citycode: place.citycode });
                    setQuery(place.label);
                    setPlaces([]);
                  }}
                >
                  <span className="font-medium">{place.label}</span>
                  {place.context ? (
                    <span className="block text-xs text-muted-foreground">{place.context}</span>
                  ) : null}
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      <input type="hidden" name="label" value={chosen?.label ?? ""} />
      <input type="hidden" name="citycode" value={chosen?.citycode ?? ""} />
      <div className="grid gap-2">
        <Label htmlFor="radius">Rayon de recherche</Label>
        <select
          id="radius"
          name="radius"
          defaultValue={radiusDefault}
          className={selectClassName + " sm:w-48"}
        >
          {RADIUS_OPTIONS.map((radius) => (
            <option key={radius} value={radius}>
              {radius} km
            </option>
          ))}
        </select>
        <FieldHint>Vous pourrez l’élargir si vous trouvez peu d’offres.</FieldHint>
      </div>
      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      <Button type="submit" disabled={pending || !chosen} className="w-fit">
        {pending ? "Vérification…" : "Continuer"}
      </Button>
    </ActionForm>
  );
}
