import { z } from "zod";

import { tokenize } from "@/lib/text/french";

/**
 * Letter adaptation without a language model (docs/QUESTIONS.md B11). It keeps the output
 * contract of the prompt in brief section 6.1, so a model can replace these rules later
 * without touching the screens. Rules only move facts that are already known: the company,
 * job title and city from the offer, and the skills that the offer asks for and the CV
 * already lists. Nothing is invented, and every `original` is a passage of the base letter.
 */

export const CoverLetterChangeSchema = z.object({
  original: z.string(),
  replacement: z.string(),
  reason: z.string(),
});
export const CoverLetterResultSchema = z.object({
  letter: z.string(),
  changes: z.array(CoverLetterChangeSchema),
  confidence: z.number().min(0).max(1),
  missing_info: z.array(z.string()),
});
export type CoverLetterChange = z.infer<typeof CoverLetterChangeSchema>;
export type CoverLetterResult = z.infer<typeof CoverLetterResultSchema>;

export const LETTER_GENERATOR = "rules-v1";

export type AdaptLetterInput = {
  baseLetter: string;
  offer: { title: string; companyName: string | null; city: string | null; skills: string[] };
  cvText: string;
};

type Slot = "company" | "title" | "city";
type Span = { start: number; end: number; replacement: string; reason: string };

const MIN_RATIO = 0.9;
const MAX_RATIO = 1.1;
const PLACEHOLDER = /\[([^\]\n]{1,40})\]|\{\{?([^}\n]{1,40})\}?\}|<<([^>\n]{1,40})>>|\bX{3,}\b/g;
const REASONS: Record<Slot, string> = {
  company: "Nom de l'entreprise visée par l'offre.",
  title: "Intitulé du poste repris de l'offre.",
  city: "Ville indiquée dans l'offre.",
};
/** Words of skill lists that are not skills themselves. */
const SKILL_NOISE = new Set(
  "maitrise maitriser connaissance connaissances notion notions bonne bonnes capacite capacites sens gout esprit experience experiences competence competences outil outils savoir etre faire niveau base bases utilisation usage souhaitee souhaite requise requis appreciee apprecie idealement minimum equipe projet projets travail travailler mission missions poste entreprise client clients gestion".split(
    " ",
  ),
);

const normalize = (value: string) => value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function slotOf(label: string): Slot | null {
  const text = normalize(label);
  if (/(entreprise|societe|structure|employeur|organisation|company)/.test(text)) return "company";
  if (/(poste|offre|intitule|metier|job)/.test(text)) return "title";
  if (/(ville|lieu|localisation|city)/.test(text)) return "city";
  return null;
}

/** "Développeur web (H/F) - Lyon" gives "Développeur web". */
export function cleanOfferTitle(title: string): string {
  let clean = title.replace(/\(?\s*\b[HFhf]\s*\/\s*[HFhf]\b\s*\)?/g, " ");
  clean = clean.split(/\s[-–|]\s/)[0] ?? clean;
  for (let previous = ""; previous !== clean;) {
    previous = clean;
    clean = clean.replace(/\s*\([^()]*\)\s*$/, "").trim();
  }
  return clean.replace(/\s+/g, " ").trim();
}

/** Skills named in the offer's skill lists that the CV also contains, in the offer's spelling. */
export function sharedSkills(offerSkills: string[], cvText: string, max = 3): string[] {
  const cv = new Set(tokenize(cvText, 2));
  const found: string[] = [];
  const seen = new Set<string>();
  for (const line of offerSkills) {
    for (const raw of line.split(/[\s,;:()/]+/)) {
      const word = raw.replace(/^[^\p{L}\p{N}]+|[^\p{L}\p{N}#+]+$/gu, "");
      const key = tokenize(word, 2)[0];
      if (!key || word.length < 2 || SKILL_NOISE.has(key) || seen.has(key) || !cv.has(key))
        continue;
      seen.add(key);
      found.push(word);
      if (found.length >= max) return found;
    }
  }
  return found;
}

function skillsSentence(skills: string[]): string {
  const list =
    skills.length === 1 ? skills[0] : `${skills.slice(0, -1).join(", ")} et ${skills.at(-1)}`;
  return skills.length === 1
    ? `Votre offre cite ${list}, une compétence qui figure dans mon CV.`
    : `Votre offre cite ${list}, des compétences qui figurent dans mon CV.`;
}

export function applySpans(text: string, spans: Span[]): string {
  let output = "";
  let cursor = 0;
  for (const span of [...spans].sort((a, b) => a.start - b.start)) {
    output += text.slice(cursor, span.start) + span.replacement;
    cursor = span.end;
  }
  return output + text.slice(cursor);
}

/** Last sentence of the first real paragraph: where the skills sentence goes. */
function insertionPoint(text: string): { start: number; end: number } | null {
  for (const match of text.matchAll(/(?:[^\n]|\n(?![ \t]*\n))+/g)) {
    const paragraph = match[0].trimEnd();
    if (paragraph.trim().length < 80 || /^\s*objet\s*:/i.test(paragraph)) continue;
    const start = match.index;
    const end = start + paragraph.length;
    let sentenceStart = start + (paragraph.length - paragraph.trimStart().length);
    for (const boundary of paragraph.matchAll(/[.!?…]\s+(?=\p{Lu})/gu)) {
      const position = start + boundary.index + boundary[0].length;
      if (position < end - 1) sentenceStart = position;
    }
    return { start: sentenceStart, end };
  }
  return null;
}

export function adaptLetter(input: AdaptLetterInput): CoverLetterResult {
  const base = input.baseLetter;
  const title = cleanOfferTitle(input.offer.title) || null;
  const company = input.offer.companyName?.trim() || null;
  const values: Record<Slot, string | null> = {
    company,
    title,
    city: input.offer.city?.trim() || null,
  };
  const spans: Span[] = [];
  const missing = new Set<string>();
  const overlaps = (start: number, end: number) =>
    spans.some((span) => start < span.end && end > span.start);
  let companyDone = false;
  let titleDone = false;

  const subject = /^(objet\s*:\s*)(.+)$/im.exec(base);
  if (subject && title) {
    const start = subject.index + (subject[1] ?? "").length;
    const end = start + (subject[2] ?? "").length;
    const replacement = `Candidature en alternance au poste de ${title}`;
    if (base.slice(start, end).trim() !== replacement) {
      spans.push({ start, end, replacement, reason: "Objet aligné sur l'intitulé de l'offre." });
    }
    titleDone = true;
  }

  for (const match of base.matchAll(PLACEHOLDER)) {
    const start = match.index;
    const end = start + match[0].length;
    if (overlaps(start, end)) continue;
    const slot = slotOf(match[1] ?? match[2] ?? match[3] ?? "entreprise");
    const value = slot ? values[slot] : null;
    if (!slot || !value) {
      missing.add(`Passage à compléter dans votre lettre : ${match[0]}`);
      continue;
    }
    spans.push({ start, end, replacement: value, reason: REASONS[slot] });
    if (slot === "company") companyDone = true;
    if (slot === "title") titleDone = true;
  }

  if (!companyDone && company) {
    const generic = /\bvotre (entreprise|société|structure|organisation)(?!\p{L})/iu.exec(base);
    if (generic && !overlaps(generic.index, generic.index + generic[0].length)) {
      spans.push({
        start: generic.index,
        end: generic.index + generic[0].length,
        replacement: company,
        reason: "Nom de l'entreprise à la place d'une formule générale.",
      });
      companyDone = true;
    }
  }
  if (!company) missing.add("L'offre ne précise pas le nom de l'employeur.");

  let skillsDone = false;
  const skills = sharedSkills(input.offer.skills, input.cvText);
  const target = skills.length > 0 ? insertionPoint(base) : null;
  if (skills.length === 0) {
    missing.add(
      "Aucune compétence demandée par l'offre ne figure dans votre CV : ajoutez une phrase personnelle sur les missions.",
    );
  } else if (target) {
    const inner = spans.filter((span) => span.start >= target.start && span.end <= target.end);
    const outer = spans.filter((span) => !inner.includes(span));
    if (!outer.some((span) => span.start < target.end && span.end > target.start)) {
      const shifted = inner.map((span) => ({
        ...span,
        start: span.start - target.start,
        end: span.end - target.start,
      }));
      const merged: Span = {
        start: target.start,
        end: target.end,
        replacement: `${applySpans(base.slice(target.start, target.end), shifted)} ${skillsSentence(skills)}`,
        reason: [
          ...inner.map((span) => span.reason),
          "Compétences demandées par l'offre et déjà présentes dans votre CV.",
        ].join(" "),
      };
      const candidate = [...outer, merged];
      const length = applySpans(base, candidate).length;
      if (length >= base.length * MIN_RATIO && length <= base.length * MAX_RATIO) {
        spans.splice(0, spans.length, ...candidate);
        skillsDone = true;
      }
    }
  }

  spans.sort((a, b) => a.start - b.start);
  if (!companyDone && !titleDone) {
    missing.add(
      "Votre lettre de base ne contient ni [entreprise] ni [poste] : ajoutez ces repères pour que l'adaptation se fasse automatiquement.",
    );
  }
  const confidence =
    0.4 + (companyDone ? 0.25 : 0) + (titleDone ? 0.2 : 0) + (skillsDone ? 0.15 : 0);
  return {
    letter: applySpans(base, spans),
    changes: spans.map((span) => ({
      original: base.slice(span.start, span.end),
      replacement: span.replacement,
      reason: span.reason,
    })),
    confidence: Math.round(Math.min(1, confidence) * 100) / 100,
    missing_info: [...missing],
  };
}
