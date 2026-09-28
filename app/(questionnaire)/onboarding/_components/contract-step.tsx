import { saveContract } from "../actions";
import { ChoiceCards } from "./choice-cards";

const CONTRACTS = [
  { value: "alternance", label: "Une alternance", hint: "Apprentissage ou professionnalisation" },
  { value: "stage", label: "Un stage", hint: "Offres bientôt disponibles" },
  { value: "both", label: "Les deux", hint: "Vous prenez ce qui vient" },
] as const;

export function ContractStep({ chosen }: { chosen: string | null }) {
  return <ChoiceCards action={saveContract} choices={CONTRACTS} selected={chosen} />;
}
