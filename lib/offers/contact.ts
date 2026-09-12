/**
 * Ways to reach a recruiter (docs/QUESTIONS.md C87). No source gives an email address, so
 * the channels are: the phone number when the offer carries one, the page of the offer, and
 * the employer's own website. Nothing here is invented: an absent channel is simply absent.
 */

const MIN_DIGITS = 8;
const MAX_DIGITS = 15;

function digitsOf(value: string): string {
  return value.replace(/[^\d+]/g, "").replace(/(?!^)\+/g, "");
}

/** French ten-digit numbers are shown in pairs; anything else keeps its own shape. */
export function formatPhone(value: string | null | undefined): string | null {
  const raw = value?.trim();
  if (!raw) return null;
  const digits = digitsOf(raw);
  const count = digits.replace("+", "").length;
  if (count < MIN_DIGITS || count > MAX_DIGITS) return null;
  if (/^0\d{9}$/.test(digits)) return digits.replace(/(\d{2})(?=\d)/g, "$1 ").trim();
  return raw.replace(/\s+/g, " ");
}

/** "tel:" target: a French number becomes international, the rest keeps its digits. */
export function telHref(value: string | null | undefined): string | null {
  if (!formatPhone(value)) return null;
  const digits = digitsOf(value?.trim() ?? "");
  if (/^0\d{9}$/.test(digits)) return `tel:+33${digits.slice(1)}`;
  return `tel:${digits}`;
}

export type OfferContact = {
  phone: string | null;
  telHref: string | null;
  /** Whose phone it is: a school manages some offers (`is_delegated`). */
  phoneOwner: "employer" | "school";
  applyUrl: string | null;
  website: string | null;
};

export function offerContact(input: {
  phone: string | null | undefined;
  applyUrl: string | null | undefined;
  website: string | null | undefined;
  isDelegated: boolean;
}): OfferContact {
  const https = (value: string | null | undefined) =>
    value && /^https?:\/\//i.test(value) ? value : null;
  return {
    phone: formatPhone(input.phone),
    telHref: telHref(input.phone),
    phoneOwner: input.isDelegated ? "school" : "employer",
    applyUrl: https(input.applyUrl),
    website: https(input.website),
  };
}

export function hasDirectContact(contact: OfferContact): boolean {
  return Boolean(contact.phone || contact.website);
}
