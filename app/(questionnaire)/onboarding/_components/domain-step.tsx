import { JOB_DOMAINS } from "@/lib/onboarding/domains";

import { saveDomain } from "../actions";
import { ChoiceCards } from "./choice-cards";

const CHOICES = JOB_DOMAINS.map((domain) => ({
  value: domain.id,
  label: domain.label,
  hint: domain.hint,
}));

export function DomainStep({ chosen }: { chosen: string | null }) {
  return <ChoiceCards action={saveDomain} choices={CHOICES} selected={chosen} columns={2} />;
}
