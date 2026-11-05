import { describe, expect, it } from "vitest";

import { canStashCv, HANDOFF_MAX_BYTES } from "@/lib/cv/handoff";

const file = (name: string, size: number) =>
  new File([new Uint8Array(size)], name, { type: "application/pdf" });

/** Only what the account accepts travels from the landing page (docs/QUESTIONS.md C100). */
describe("canStashCv", () => {
  it("keeps a PDF small enough for the account", () => {
    expect(canStashCv(file("cv.pdf", 1_000))).toBe(true);
    expect(canStashCv(file("CV Camille.PDF", 1_000))).toBe(true);
  });

  it("refuses what the account would reject", () => {
    // The CV of an account must be a PDF, and stay under the upload limit.
    expect(canStashCv(file("cv.docx", 1_000))).toBe(false);
    expect(canStashCv(file("cv.pdf", HANDOFF_MAX_BYTES + 1))).toBe(false);
  });
});
