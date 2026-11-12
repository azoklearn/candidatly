import { saveContract } from "../actions";
import { ChoiceCards } from "./choice-cards";

const CONTRACTS = [
  {
    value: "alternance",
    icon: "🎓",
    label: "Une alternance",
    hint: "Apprentissage ou professionnalisation",
  },
  {
    value: "stage",
    icon: "💼",
    label: "Un stage",
    hint: "Les entreprises de ton domaine près de chez toi",
  },
  {
    value: "job_etudiant",
    icon: "☕",
    label: "Un job étudiant",
    hint: "Les entreprises de ton domaine près de chez toi",
  },
  { value: "both", icon: "✨", label: "Peu importe", hint: "Tu prends ce qui vient" },
] as const;

export function ContractStep({ chosen }: { chosen: string | null }) {
  return <ChoiceCards action={saveContract} choices={CONTRACTS} selected={chosen} />;
}
