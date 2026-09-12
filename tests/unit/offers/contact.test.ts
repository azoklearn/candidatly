import { describe, expect, it } from "vitest";

import { formatPhone, hasDirectContact, offerContact, telHref } from "@/lib/offers/contact";

describe("formatPhone", () => {
  it("reads the formats the API really sends", () => {
    expect(formatPhone("06.34.04.33.39")).toBe("06 34 04 33 39");
    expect(formatPhone("0767709392")).toBe("07 67 70 93 92");
    expect(formatPhone("03 51 73 21 26")).toBe("03 51 73 21 26");
    expect(formatPhone("+33 6 12 34 56 78")).toBe("+33 6 12 34 56 78");
  });

  it("drops what is not a phone number", () => {
    expect(formatPhone(null)).toBeNull();
    expect(formatPhone("  ")).toBeNull();
    expect(formatPhone("non communiqué")).toBeNull();
    expect(formatPhone("12345")).toBeNull();
  });
});

describe("telHref", () => {
  it("dials French numbers internationally", () => {
    expect(telHref("06.34.04.33.39")).toBe("tel:+33634043339");
    expect(telHref("03 51 73 21 26")).toBe("tel:+33351732126");
    expect(telHref("+33 6 12 34 56 78")).toBe("tel:+33612345678");
    expect(telHref("pas de téléphone")).toBeNull();
  });
});

describe("offerContact", () => {
  it("keeps only real channels and says whose phone it is", () => {
    expect(
      offerContact({
        phone: "0607439590",
        applyUrl: "https://labonnealternance.apprentissage.beta.gouv.fr/emploi/x",
        website: "javascript:alert(1)",
        isDelegated: true,
      }),
    ).toEqual({
      phone: "06 07 43 95 90",
      telHref: "tel:+33607439590",
      phoneOwner: "school",
      applyUrl: "https://labonnealternance.apprentissage.beta.gouv.fr/emploi/x",
      website: null,
    });
  });

  it("reports when the offer gives no direct channel", () => {
    const contact = offerContact({
      phone: null,
      applyUrl: "https://example.org/postuler",
      website: null,
      isDelegated: false,
    });
    expect(hasDirectContact(contact)).toBe(false);
    expect(contact.phoneOwner).toBe("employer");
  });
});
