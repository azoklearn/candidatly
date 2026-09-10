import { describe, expect, it } from "vitest";

import {
  cityFromAddress,
  contractLabel,
  formatDate,
  formatDistance,
  formatRelativeDays,
} from "@/lib/format";
import { toPlainText } from "@/lib/text/html";

describe("toPlainText", () => {
  it("turns simple HTML into readable text", () => {
    expect(
      toPlainText(
        "<p>Missions :</p><ul><li>Développer</li><li>Tester &amp; livrer</li></ul><br>Fin&#8217;",
      ),
    ).toBe("Missions :\n\n- Développer\n- Tester & livrer\n\nFin’");
    expect(toPlainText(null)).toBe("");
  });
});

describe("French formatting", () => {
  const now = new Date("2026-09-11T12:00:00Z");
  it("formats dates and relative days", () => {
    expect(formatDate("2026-09-01T08:00:00Z")).toBe("1 septembre 2026");
    expect(formatRelativeDays("2026-09-11T08:00:00Z", now)).toBe("aujourd’hui");
    expect(formatRelativeDays("2026-09-10T08:00:00Z", now)).toBe("hier");
    expect(formatRelativeDays("2026-09-01T08:00:00Z", now)).toBe("il y a 10 jours");
  });

  it("formats distances, cities and contract types", () => {
    expect(formatDistance(0.4)).toBe("moins d’1 km");
    expect(formatDistance(12.6)).toBe("13 km");
    expect(cityFromAddress("20 AVENUE DE SEGUR 75007 PARIS")).toBe("Paris");
    expect(cityFromAddress("1 RUE DE LA GARE 93200 SAINT-DENIS")).toBe("Saint-Denis");
    expect(contractLabel(["apprentissage", "professionnalisation"])).toBe(
      "Apprentissage ou Professionnalisation",
    );
  });
});
