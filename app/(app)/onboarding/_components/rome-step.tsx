"use client";

import { useActionState, useState } from "react";

import { ActionForm } from "@/components/action-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";

import { saveRome, suggestRome, type FormState, type RomeSuggestState } from "../actions";
import { FieldError, FieldHint, textareaClassName } from "./fields";

type Option = { code: string; label: string; reason?: string };
const MAX_CODES = 5;

export function RomeStep({ initialText, selected }: { initialText: string; selected: Option[] }) {
  const [suggestState, suggestAction, suggesting] = useActionState<RomeSuggestState, FormData>(
    suggestRome,
    {},
  );
  const [saveState, saveAction, saving] = useActionState<FormState, FormData>(saveRome, {});
  const [overrides, setOverrides] = useState<Record<string, boolean>>({});

  const suggestions: Option[] = suggestState.suggestions ?? [];
  const selectedCodes = new Set(selected.map((option) => option.code));
  const options: Option[] = [...selected, ...suggestions.filter((s) => !selectedCodes.has(s.code))];
  const defaults =
    selectedCodes.size > 0
      ? selectedCodes
      : new Set(suggestions.slice(0, suggestState.source === "llm" ? 3 : 1).map((s) => s.code));
  const isChecked = (code: string) => overrides[code] ?? defaults.has(code);
  const checkedCount = options.filter((option) => isChecked(option.code)).length;

  return (
    <div className="grid gap-8">
      <ActionForm action={suggestAction} className="grid gap-3">
        <Label htmlFor="domain_free_text">Quel domaine visez-vous ?</Label>
        <textarea
          id="domain_free_text"
          name="domain_free_text"
          defaultValue={initialText}
          maxLength={500}
          className={textareaClassName}
          placeholder="Par exemple : développement web, communication digitale, comptabilité…"
          aria-invalid={Boolean(suggestState.fieldErrors?.domain_free_text)}
          aria-describedby="domain-hint"
        />
        <FieldHint>
          <span id="domain-hint">
            Décrivez votre formation ou le métier visé, avec vos propres mots.
          </span>
        </FieldHint>
        <FieldError id="domain-error" message={suggestState.fieldErrors?.domain_free_text} />
        {suggestState.error ? (
          <Alert variant="destructive">
            <AlertDescription>{suggestState.error}</AlertDescription>
          </Alert>
        ) : null}
        <Button type="submit" variant="outline" disabled={suggesting} className="w-fit">
          {suggesting ? "Recherche des métiers…" : "Proposer des métiers"}
        </Button>
      </ActionForm>

      {options.length > 0 ? (
        <ActionForm action={saveAction} className="grid gap-4">
          <fieldset className="grid gap-3">
            <legend className="mb-2 text-sm font-medium">
              Métiers retenus pour votre recherche ({checkedCount} sur {MAX_CODES} au maximum)
            </legend>
            {options.map((option) => {
              const checked = isChecked(option.code);
              return (
                <label
                  key={option.code}
                  className="flex gap-3 rounded-lg border p-3 text-sm has-checked:border-primary"
                >
                  <input
                    type="checkbox"
                    name="rome_codes"
                    value={option.code}
                    checked={checked}
                    disabled={!checked && checkedCount >= MAX_CODES}
                    onChange={(event) =>
                      setOverrides((current) => ({
                        ...current,
                        [option.code]: event.target.checked,
                      }))
                    }
                    className="mt-0.5 size-4 accent-primary"
                  />
                  <span className="grid gap-1">
                    <span className="font-medium">{option.label}</span>
                    {option.reason ? (
                      <span className="text-muted-foreground">{option.reason}</span>
                    ) : null}
                    <span className="text-xs text-muted-foreground">Code ROME {option.code}</span>
                  </span>
                </label>
              );
            })}
          </fieldset>
          {suggestState.source ? (
            <FieldHint>
              {suggestState.source === "llm"
                ? "Suggestions de l’IA, choisies uniquement parmi les métiers de la nomenclature officielle. Vérifiez-les avant de continuer."
                : "Suggestions issues de la nomenclature officielle des métiers."}
            </FieldHint>
          ) : null}
          {saveState.error ? (
            <Alert variant="destructive">
              <AlertDescription>{saveState.error}</AlertDescription>
            </Alert>
          ) : null}
          <Button type="submit" disabled={saving || checkedCount === 0} className="w-fit">
            {saving ? "Enregistrement…" : "Continuer"}
          </Button>
        </ActionForm>
      ) : null}
    </div>
  );
}
