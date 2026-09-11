import { describe, expect, it } from "vitest";

import { annotateSegments, diffWords } from "@/lib/letters/diff";

const rebuild = (segments: { type: string; text: string }[], keep: string) =>
  segments
    .filter((s) => s.type === "equal" || s.type === keep)
    .map((s) => s.text)
    .join("");

describe("diffWords", () => {
  it("marks replaced words and rebuilds the new text", () => {
    const before = "Je souhaite rejoindre [entreprise] dès septembre.";
    const after = "Je souhaite rejoindre HOLIS dès septembre.";
    const segments = diffWords(before, after);
    expect(segments).toEqual([
      { type: "equal", text: "Je souhaite rejoindre " },
      { type: "delete", text: "[entreprise]" },
      { type: "insert", text: "HOLIS" },
      { type: "equal", text: " dès septembre." },
    ]);
    expect(rebuild(segments, "insert")).toBe(after);
    expect(rebuild(segments, "delete")).toBe(before);
  });

  it("keeps a multi-word insertion in one highlight", () => {
    const segments = diffWords("Fin.", "Fin. Votre offre cite React.");
    expect(segments.filter((s) => s.type === "insert")).toEqual([
      { type: "insert", text: " Votre offre cite React." },
    ]);
  });
});

describe("annotateSegments", () => {
  it("attaches the reason of the matching change, or the student's own edit", () => {
    const segments = annotateSegments(diffWords("A [x] B", "A HOLIS B C"), [
      { replacement: "HOLIS", reason: "Nom de l'entreprise." },
    ]);
    expect(segments.filter((s) => s.type === "insert").map((s) => s.reason)).toEqual([
      "Nom de l'entreprise.",
      "Modifié par vous.",
    ]);
  });
});
