"use client";

import { useActionState, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { z } from "zod";

import { ActionForm } from "@/components/action-form";
import { SubmitButton } from "@/components/submit-button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PRESET_CITIES, RADIUS_OPTIONS } from "@/lib/onboarding/cities";
import { cn } from "@/lib/utils";

import { saveScanProfile, type FormState } from "../actions";
import { FieldError, selectClassName } from "./fields";

/**
 * The single screen that follows a CV dropped on the landing page (docs/QUESTIONS.md C100):
 * what the scan understood, ready to confirm, with everything it missed asked right here.
 * The five questions stay for visitors who arrive without a CV.
 */

export type JobOption = { code: string; label: string };
export type DomainOption = { id: string; label: string; hint: string };

const MAX_CODES = 5;

const CONTRACTS = [
  { value: "alternance", label: "Alternance" },
  { value: "stage", label: "Stage", hint: "bientôt" },
  { value: "job_etudiant", label: "Job étudiant", hint: "bientôt" },
  { value: "both", label: "Peu importe" },
] as const;

const LEVELS = [
  { value: "bac", label: "Bac" },
  { value: "bac+2", label: "Bac+2" },
  { value: "bac+3", label: "Bac+3" },
  { value: "bac+4", label: "Bac+4" },
  { value: "bac+5", label: "Bac+5" },
] as const;

const PlaceSchema = z.object({
  label: z.string(),
  citycode: z.string().nullable(),
  context: z.string().nullable(),
});
const ResponseSchema = z.object({ places: z.array(PlaceSchema) });
type Place = z.infer<typeof PlaceSchema>;

const DEBOUNCE_MS = 300;

function Row({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <section className="grid gap-2 border-t pt-4 first:border-0 first:pt-0">
      <h2 className="text-sm font-medium">
        {title}
        {hint ? <span className="ml-2 font-normal text-muted-foreground">{hint}</span> : null}
      </h2>
      {children}
    </section>
  );
}

/** Radio buttons shown as pills: the answer is one tap, and nothing submits yet. */
function Pills({
  name,
  options,
  defaultValue,
}: {
  name: string;
  options: readonly { value: string; label: string; hint?: string }[];
  defaultValue: string | null;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((option, index) => (
        <label
          key={option.value}
          style={{ "--i": index } as CSSProperties}
          className={cn(
            "q-card q-in flex min-h-11 cursor-pointer items-center gap-1.5 rounded-full border px-4 py-2 text-sm",
            "hover:bg-muted/60 has-checked:border-foreground has-checked:bg-foreground has-checked:text-background",
          )}
        >
          <input
            type="radio"
            name={name}
            value={option.value}
            defaultChecked={defaultValue === option.value}
            className="sr-only"
          />
          <span>{option.label}</span>
          {option.hint ? <span className="text-xs opacity-70">({option.hint})</span> : null}
        </label>
      ))}
    </div>
  );
}

export function ScanRecap({
  contract,
  domainId,
  romeCodes,
  level,
  cityLabel,
  radius: initialRadius,
  domains,
  jobsByDomain,
}: {
  contract: string | null;
  domainId: string | null;
  romeCodes: readonly string[];
  level: string | null;
  cityLabel: string | null;
  radius: number;
  domains: readonly DomainOption[];
  jobsByDomain: Record<string, JobOption[]>;
}) {
  const [state, action, pending] = useActionState<FormState, FormData>(saveScanProfile, {});
  const [domain, setDomain] = useState(domainId ?? domains[0]?.id ?? "");
  const [codes, setCodes] = useState<string[]>([...romeCodes]);
  const [radius, setRadius] = useState(
    (RADIUS_OPTIONS as readonly number[]).includes(initialRadius) ? initialRadius : 30,
  );
  // The city read on the CV is kept until the student opens the picker.
  const [city, setCity] = useState<string | null>(cityLabel);
  const [picking, setPicking] = useState(cityLabel === null);
  const [locating, setLocating] = useState(false);
  const [positionError, setPositionError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [places, setPlaces] = useState<Place[]>([]);
  const [searching, setSearching] = useState(false);

  const [place, setPlace] = useState({ city: "", lat: "", lng: "", label: "", citycode: "" });
  const [chosen, setChosen] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controller = useRef<AbortController | null>(null);

  const jobs = jobsByDomain[domain] ?? [];

  function changeDomain(id: string) {
    setDomain(id);
    // Three jobs ticked by default: the student narrows down instead of starting from nothing.
    setCodes((jobsByDomain[id] ?? []).slice(0, 3).map((job) => job.code));
  }

  function toggle(code: string) {
    setCodes((current) =>
      current.includes(code)
        ? current.filter((value) => value !== code)
        : current.length >= MAX_CODES
          ? current
          : [...current, code],
    );
  }

  function pickPlace(values: Partial<typeof place>, label: string) {
    setPlace({ city: "", lat: "", lng: "", label: "", citycode: "", ...values });
    setCity(label);
    setChosen(true);
    setPicking(false);
    setPositionError(null);
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
        pickPlace(
          { lat: String(position.coords.latitude), lng: String(position.coords.longitude) },
          "Ta position",
        );
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

  return (
    <ActionForm action={action} className="grid gap-6">
      <div className="grid gap-4 rounded-2xl border bg-card p-4 sm:p-5">
        <Row title="Tu cherches">
          <Pills name="target_contract" options={CONTRACTS} defaultValue={contract} />
          <FieldError id="contract-error" message={state.fieldErrors?.target_contract} />
        </Row>

        <Row title="Ton domaine">
          <select
            name="domain"
            value={domain}
            onChange={(event) => changeDomain(event.target.value)}
            className={cn(selectClassName, "h-11")}
            aria-label="Ton domaine"
          >
            {domains.map((option) => (
              <option key={option.id} value={option.id}>
                {option.label}
              </option>
            ))}
          </select>
          <FieldError id="domain-error" message={state.fieldErrors?.domain} />
        </Row>

        <Row title="Tes métiers" hint={`${codes.length}/${MAX_CODES}`}>
          <ul className="flex flex-wrap gap-2">
            {jobs.map((job) => {
              const isChecked = codes.includes(job.code);
              const full = !isChecked && codes.length >= MAX_CODES;
              return (
                <li key={job.code}>
                  <label
                    className={cn(
                      "q-card flex min-h-11 cursor-pointer items-center rounded-full border px-4 py-2 text-sm hover:bg-muted/60",
                      isChecked && "border-foreground bg-foreground text-background",
                      full && "cursor-not-allowed opacity-50",
                    )}
                  >
                    <input
                      type="checkbox"
                      name="rome_codes"
                      value={job.code}
                      checked={isChecked}
                      disabled={full}
                      onChange={() => toggle(job.code)}
                      className="sr-only"
                    />
                    {job.label}
                  </label>
                </li>
              );
            })}
          </ul>
          <FieldError id="jobs-error" message={state.fieldErrors?.rome_codes} />
        </Row>

        <Row title="Ton niveau">
          <Pills name="diploma_level" options={LEVELS} defaultValue={level} />
          <FieldError id="level-error" message={state.fieldErrors?.diploma_level} />
        </Row>

        <Row title="Ta ville">
          <input type="hidden" name="city_mode" value={chosen ? "pick" : "keep"} readOnly />
          <input type="hidden" name="has_city" value={city ? "1" : "0"} readOnly />
          <input type="hidden" name="city" value={place.city} readOnly />
          <input type="hidden" name="lat" value={place.lat} readOnly />
          <input type="hidden" name="lng" value={place.lng} readOnly />
          <input type="hidden" name="label" value={place.label} readOnly />
          <input type="hidden" name="citycode" value={place.citycode} readOnly />
          <input type="hidden" name="radius" value={radius} readOnly />

          {city && !picking ? (
            <p className="flex flex-wrap items-center gap-2 text-sm">
              <span className="font-medium">{city}</span>
              <span className="text-muted-foreground">· jusqu’à {radius} km</span>
              <button
                type="button"
                onClick={() => setPicking(true)}
                className="underline underline-offset-4 hover:text-foreground"
              >
                Changer
              </button>
            </p>
          ) : null}

          {picking ? (
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                {PRESET_CITIES.map((preset, index) => (
                  <button
                    key={preset.id}
                    type="button"
                    style={{ "--i": index } as CSSProperties}
                    onClick={() => pickPlace({ city: preset.id }, preset.label)}
                    className={cn(
                      "q-card q-in min-h-11 rounded-xl border bg-card px-3 py-2 text-sm hover:border-foreground hover:bg-muted/40",
                      city === preset.label && "border-foreground bg-primary/5",
                    )}
                  >
                    {preset.label}
                  </button>
                ))}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="place">Une autre ville ou ton adresse</Label>
                <Input
                  id="place"
                  value={query}
                  onChange={(event) => onQueryChange(event.target.value)}
                  autoComplete="off"
                  aria-describedby="place-status"
                  placeholder="Par exemple : Angers"
                />
                <p id="place-status" className="text-sm text-muted-foreground" aria-live="polite">
                  {searching ? "Recherche…" : "Tape au moins 3 lettres, puis choisis."}
                </p>
                {places.length > 0 ? (
                  <ul className="grid gap-1 rounded-xl border p-1">
                    {places.map((suggestion) => (
                      <li key={`${suggestion.label}-${suggestion.citycode}`}>
                        <button
                          type="button"
                          disabled={!suggestion.citycode}
                          onClick={() =>
                            suggestion.citycode
                              ? pickPlace(
                                  { label: suggestion.label, citycode: suggestion.citycode },
                                  suggestion.label,
                                )
                              : undefined
                          }
                          className="w-full rounded-lg px-2 py-1.5 text-left text-sm hover:bg-muted"
                        >
                          <span className="font-medium">{suggestion.label}</span>
                          {suggestion.context ? (
                            <span className="block text-xs text-muted-foreground">
                              {suggestion.context}
                            </span>
                          ) : null}
                        </button>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={useMyPosition}
                disabled={locating}
                className="w-fit"
              >
                {locating ? "Localisation…" : "Utiliser ma position"}
              </Button>
              {positionError ? <p className="text-sm text-destructive">{positionError}</p> : null}
            </div>
          ) : null}

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
          <FieldError id="city-error" message={state.fieldErrors?.city} />
        </Row>
      </div>

      {state.error ? (
        <Alert variant="destructive">
          <AlertDescription>{state.error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="grid gap-2">
        <SubmitButton variant="shiny" size="lg" pendingLabel="On cherche tes offres…">
          Voir mes offres
        </SubmitButton>
        <p className="text-sm text-muted-foreground">
          {pending ? "Un instant…" : "Tout reste modifiable plus tard depuis ton compte."}
        </p>
      </div>
    </ActionForm>
  );
}
