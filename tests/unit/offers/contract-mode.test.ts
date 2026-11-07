import { describe, expect, it } from "vitest";

import { companiesOnly } from "@/lib/offers/contract-mode";

describe("companiesOnly", () => {
  it("sends internships and student jobs to the companies of the domain (C106)", () => {
    expect(companiesOnly("stage")).toBe(true);
    expect(companiesOnly("job_etudiant")).toBe(true);
  });

  it("keeps the work-study offers for alternance and « Peu importe »", () => {
    expect(companiesOnly("alternance")).toBe(false);
    expect(companiesOnly("both")).toBe(false);
    expect(companiesOnly(null)).toBe(false);
    expect(companiesOnly(undefined)).toBe(false);
  });
});
