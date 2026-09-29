"use client";

import { useActionState, useRef, useState, type CSSProperties } from "react";
import { z } from "zod";

import { ActionForm } from "@/components/action-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PRESET_CITIES, RADIUS_OPTIONS } from "@/lib/onboarding/cities";
import { cn } from "@/lib/utils";

import { saveLocation, type FormState } from "../actions";

const PlaceSchema = z.object({
  label: z.string(),
  citycode: z.string().nullable(),
  context: z.string().nullable(),
});
const ResponseSchema = z.object({ places: z.array(PlaceSchema) });
type Place = z.infer<typeof PlaceSchema>;

const DEBOUNCE_MS = 300;

/**
 * Step 5 with clicks (docs/QUESTIONS.md C92): the position of the browser, a city of the
 * list, or, for everywhere else, the address search.
 */
export function CityStep({
  initialLabel,
  initialRadius,
}: {
  initialLabel: string | null;
  initialRadius: number;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveLocation, {});
  const [radius, setRadius] = useState(
    (RADIUS_OPTIONS as readonly number[]).includes(initialRadius) ? initialRadius : 30,
  );
  const [other, setOther] = useState(false);
  const [locating, setLocating] = useState(false);
  const [positionError, setPositionError] = useState<string | null>(null);
  const [query, setQuery] = useState(initialLabel ?? "");
  const [places, setPlaces] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);

  const form = useRef<HTMLFormElement>(null);
  const cityField = useRef<HTMLInputElement>(null);
  const latField = useRef<HTMLInputElement>(null);
  const lngField = useRef<HTMLInputElement>(null);
  const labelField = useRef<HTMLInputElement>(null);
  const citycodeField = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controller = useRef<AbortController | null>(null);

  function submitWith(values: {
    city?: string;
    lat?: string;
    lng?: string;
    label?: string;
    citycode?: string;
  }) {
    if (cityField.current) cityField.current.value = values.city ?? "";
    if (latField.current) latField.current.value = values.lat ?? "";
    if (lngField.current) lngField.current.value = values.lng ?? "";
    if (labelField.current) labelField.current.value = values.label ?? "";
    if (citycodeField.current) citycodeField.current.value = values.citycode ?? "";
    form.current?.requestSubmit();
  }

  function useMyPosition() {
    setPositionError(null);
    if (!navigator.geolocation) {
      setPositionError("Ton navigateur ne donne pas ta position. Choisis une ville.");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setLocating(false);
        submitWith({
          lat: String(position.coords.latitude),
          lng: String(position.coords.longitude),
        });
      },
      () => {
        setLocating(false);
        setPositionError("On n’a pas pu lire ta position. Choisis une ville.");
      },
      { timeout: 10_000, maximumAge: 60_000 },
    );
  }

  function onQueryChange(value: string) {
    setQuery(value);
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

  const busy = pending || locating;

  return (
    <ActionForm ref={form} action={action} className="grid gap-6">
      <input type="hidden" name="city" ref={cityField} />
      <input type="hidden" name="lat" ref={latField} />
      <input type="hidden" name="lng" ref={lngField} />
      <input type="hidden" name="label" ref={labelField} />
      <input type="hidden" name="citycode" ref={citycodeField} />
      <input type="hidden" name="radius" value={radius} readOnly />

      <fieldset className="grid gap-2">
        <legend className="mb-2 text-sm font-medium">Jusqu’où tu peux aller ?</legend>
        <div className="flex flex-wrap gap-2">
          {RADIUS_OPTIONS.map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setRadius(option)}
              aria-pressed={radius === option}
              className={cn(
                "q-card min-h-11 rounded-full border px-4 py-2 text-sm hover:bg-muted/60",
                radius === option && "border-foreground bg-foreground text-background",
              )}
            >
              {option} km
            </button>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-3">
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={useMyPosition}
          disabled={busy}
          className="w-fit"
        >
          {locating ? "Localisation…" : "Utiliser ma position"}
        </Button>
        {positionError ? <p className="text-sm text-destructive">{positionError}</p> : null}
      </div>

      <div className="grid gap-3">
        <p className="text-sm font-medium">Ou choisis ta ville</p>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {PRESET_CITIES.map((city, index) => (
            <button
              key={city.id}
              type="button"
              disabled={busy}
              style={{ "--i": index } as CSSProperties}
              onClick={() => submitWith({ city: city.id })}
              className={cn(
                "q-card q-in min-h-14 rounded-2xl border bg-card p-3 text-sm font-medium hover:border-foreground hover:bg-muted/40 disabled:opacity-60",
                initialLabel === city.label && "border-foreground bg-primary/5",
              )}
            >
              {city.label}
            </button>
          ))}
        </div>
      </div>

      {other ? (
        <div className="grid gap-2">
          <Label htmlFor="place">Ta ville ou ton adresse</Label>
          <Input
            id="place"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            autoComplete="off"
            aria-describedby="place-status"
            placeholder="Par exemple : Angers, ou 10 rue de la Paix, Angers"
          />
          <p id="place-status" className="text-sm text-muted-foreground" aria-live="polite">
            {searching ? "Recherche…" : "Tape au moins 3 lettres, puis choisis."}
          </p>
          {places.length > 0 ? (
            <ul className="grid gap-1 rounded-xl border p-1">
              {places.map((place) => (
                <li key={`${place.label}-${place.citycode}`}>
                  <button
                    type="button"
                    className="w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted"
                    disabled={!place.citycode || busy}
                    onClick={() =>
                      place.citycode
                        ? submitWith({ label: place.label, citycode: place.citycode })
                        : undefined
                    }
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
      ) : (
        <button
          type="button"
          onClick={() => setOther(true)}
          className="w-fit text-sm text-muted-foreground underline underline-offset-4 hover:text-foreground"
        >
          Ma ville n’est pas là
        </button>
      )}

      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}
      {pending ? <p className="text-sm text-muted-foreground">Un instant…</p> : null}
    </ActionForm>
  );
}
