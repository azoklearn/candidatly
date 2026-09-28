import { saveLevel } from "../actions";
import { ChoiceCards } from "./choice-cards";

const LEVELS = [
  { value: "bac", label: "Bac", hint: "Bac professionnel, brevet professionnel…" },
  { value: "bac+2", label: "Bac+2", hint: "BTS, BUT 2e année…" },
  { value: "bac+3", label: "Bac+3", hint: "Licence, BUT, bachelor…" },
  { value: "bac+4", label: "Bac+4", hint: "Master 1…" },
  { value: "bac+5", label: "Bac+5", hint: "Master, école d’ingénieur ou de commerce…" },
] as const;

export function LevelStep({ chosen }: { chosen: string | null }) {
  return <ChoiceCards action={saveLevel} choices={LEVELS} selected={chosen} columns={2} />;
}
