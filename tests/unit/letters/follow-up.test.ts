import { describe, expect, it } from "vitest";

import { followUpMessage, isFollowUpDue } from "@/lib/letters/follow-up";

describe("follow-up", () => {
  const now = new Date("2026-09-20T10:00:00Z").getTime();

  it("is due for sent applications whose follow-up date has passed", () => {
    expect(isFollowUpDue("sent", "2026-09-19T10:00:00Z", now)).toBe(true);
    expect(isFollowUpDue("sent", "2026-09-21T10:00:00Z", now)).toBe(false);
    expect(isFollowUpDue("replied_positive", "2026-09-19T10:00:00Z", now)).toBe(false);
    expect(isFollowUpDue("sent", null, now)).toBe(false);
  });

  it("writes a short message with the offer, the date and the student's name", () => {
    const message = followUpMessage({
      title: "Développeur web (H/F) - Paris",
      companyName: "HOLIS",
      sentAt: "2026-09-11T09:00:00Z",
      studentName: "Camille Testeur",
    });
    expect(message).toContain("Objet : Relance de ma candidature au poste de Développeur web");
    expect(message).toContain(
      "Le 11 septembre 2026, je vous ai adressé ma candidature en alternance pour le poste de Développeur web chez HOLIS.",
    );
    expect(message.endsWith("Camille Testeur")).toBe(true);
    expect(message).not.toMatch(/—/);
  });

  it("stays correct without a date, a company or a name", () => {
    const message = followUpMessage({
      title: "Comptable",
      companyName: null,
      sentAt: null,
      studentName: null,
    });
    expect(message).toContain(
      "Je vous ai récemment adressé ma candidature en alternance pour le poste de Comptable.",
    );
    expect(message.endsWith("Bien cordialement,")).toBe(true);
  });
});
