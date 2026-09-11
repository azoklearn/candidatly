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

describe("grouped changes", () => {
  it("shows a rewritten passage as one removal then one addition", () => {
    const before = "Objet : Candidature pour une alternance en développement web";
    const after = "Objet : Candidature en alternance au poste de Développeur Full-Stack";
    const segments = diffWords(before, after);
    expect(rebuild(segments, "insert")).toBe(after);
    const spaceBetweenChanges = segments.some(
      (segment, i) =>
        i > 0 &&
        segment.type === "equal" &&
        /^\s+$/.test(segment.text) &&
        segments[i - 1]?.type !== "equal" &&
        segments[i + 1] !== undefined &&
        segments[i + 1]?.type !== "equal",
    );
    expect(spaceBetweenChanges).toBe(false);
    expect(segments.filter((s) => s.type === "insert").length).toBeLessThanOrEqual(2);
  });

  it("gives a passage the reason of the most specific change, matching whole words only", () => {
    const changes = [
      { replacement: "Candidature en alternance au poste de Développeur", reason: "Objet." },
      { replacement: "Développeur", reason: "Intitulé." },
    ];
    const segments = annotateSegments(
      [
        { type: "insert", text: "Développeur" },
        { type: "equal", text: " " },
        { type: "insert", text: "en" },
      ],
      changes,
    );
    expect(segments.map((s) => s.reason)).toEqual(["Intitulé.", undefined, "Objet."]);
  });
});
