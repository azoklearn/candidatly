import { describe, expect, it } from "vitest";

import { AGE_BRACKETS, minimumPay, SMIC_MONTHLY_CENTS } from "@/lib/tools/apprentice-pay";

describe("minimum pay of a work-study student (C122)", () => {
  it("follows the legal grid of the apprenticeship contract", () => {
    const grid = AGE_BRACKETS.map((age) =>
      ([1, 2, 3] as const).map(
        (year) => minimumPay({ contract: "apprentissage", age, year }).percent,
      ),
    );
    expect(grid).toEqual([
      [27, 39, 55],
      [43, 51, 67],
      [53, 61, 78],
      [100, 100, 100],
    ]);
  });

  it("turns the percentage into euros on the SMIC in force", () => {
    expect(SMIC_MONTHLY_CENTS).toBe(186_702);
    // 43 % of 1 867,02 € is 802,82 €.
    expect(minimumPay({ contract: "apprentissage", age: "18-20", year: 1 }).monthlyCents).toBe(
      80_282,
    );
    expect(minimumPay({ contract: "apprentissage", age: "26+", year: 2 }).monthlyCents).toBe(
      186_702,
    );
  });

  it("follows the grid of the professionalisation contract, by age and qualification", () => {
    const pay = (age: (typeof AGE_BRACKETS)[number], qualified: boolean) =>
      minimumPay({ contract: "professionnalisation", age, qualified }).percent;
    expect([pay("under18", false), pay("18-20", false), pay("18-20", true)]).toEqual([55, 55, 65]);
    expect([pay("21-25", false), pay("21-25", true)]).toEqual([70, 80]);
    expect([pay("26+", false), pay("26+", true)]).toEqual([100, 100]);
  });

  it("says when the collective agreement can raise the minimum", () => {
    expect(minimumPay({ contract: "apprentissage", age: "18-20", year: 3 }).agreementMayApply).toBe(
      false,
    );
    expect(minimumPay({ contract: "apprentissage", age: "21-25", year: 1 }).agreementMayApply).toBe(
      true,
    );
  });
});
