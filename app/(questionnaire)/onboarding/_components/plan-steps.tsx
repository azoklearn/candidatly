import { BLOCKERS, RHYTHMS, SITUATIONS } from "@/lib/onboarding/plan";

import { saveBlocker, saveRhythm, saveSituation } from "../actions";
import { ChoiceCards } from "./choice-cards";

/** The one-click questions that shape the plan (docs/QUESTIONS.md C118). */

export function SituationStep({ chosen }: { chosen: string | null }) {
  return <ChoiceCards action={saveSituation} choices={SITUATIONS} selected={chosen} />;
}

export function RhythmStep({ chosen }: { chosen: string | null }) {
  return <ChoiceCards action={saveRhythm} choices={RHYTHMS} selected={chosen} />;
}

export function BlockerStep({ chosen }: { chosen: string | null }) {
  return <ChoiceCards action={saveBlocker} choices={BLOCKERS} selected={chosen} />;
}
