"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getAnthropicClient, getModels } from "@/lib/ai/client";
import { EVENTS } from "@/lib/analytics";
import { trackServerEvent } from "@/lib/analytics-server";
import { suggestRomeCodes, toSearchTerms, type RomeSuggestion } from "@/lib/ai/rome-mapping";
import { currentUserId, requireUserId } from "@/lib/auth/session";
import { allowAnonymousAction } from "@/lib/anon-rate-limit";
import {
  DOCUMENT_MIME_TYPES,
  MAX_DOCUMENT_BYTES,
  extractDocumentText,
  normalizeExtractedText,
} from "@/lib/documents/extract-text";
import { ExternalApiError, ValidationError } from "@/lib/errors";
import { resolvePlace, reversePlace } from "@/lib/geocoding/geocode";
import { requestOffersRefresh } from "@/lib/offers/request-refresh";
import { logger } from "@/lib/logger";
import { allowAction, RATE_LIMITED_MESSAGE } from "@/lib/rate-limit";
import { DEFAULT_RADIUS_KM, findPresetCity, RADIUS_OPTIONS } from "@/lib/onboarding/cities";
import { findDomain } from "@/lib/onboarding/domains";
import { readDraft, saveDraft } from "@/lib/onboarding/draft-cookie";
import {
  ACCOUNT_STEP,
  ACCOUNT_STEP_PATH,
  DOCUMENTS_STEP,
  firstIncompleteStep,
  LAST_STEP,
} from "@/lib/onboarding/state";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Database, TablesInsert } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

import { loadOnboarding } from "./data";

export type FormState = { error?: string; fieldErrors?: Record<string, string>; saved?: boolean };
export type RomeSuggestState = FormState & {
  suggestions?: RomeSuggestion[];
  source?: "llm" | "search";
};
export type DocumentResult = { ok: true } | { ok: false; error: string };

const GENERIC_ERROR = "Une erreur est survenue. Réessaie dans un instant.";
const PHONE = /^(?:\+33\s?|0)[1-9](?:[\s.-]?\d{2}){4}$/;
const log = logger.child({ area: "onboarding" });

const read = (formData: FormData, key: string) => String(formData.get(key) ?? "");

/**
 * The questionnaire is open before the account exists (docs/QUESTIONS.md C91): a visitor's
 * answers go to a cookie, and the reference data is read with the service key, since the
 * ROME tables are readable by signed-in users only.
 */
async function onboardingContext(formData: FormData) {
  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  // The account page always runs with a session behind it.
  if (!userId && read(formData, "mode") === "account") redirect("/login");
  return { supabase, userId, reference: userId ? supabase : createAdminClient() };
}

function toFieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    result[key] ??= issue.message;
  }
  return result;
}

const optional = (max: number) =>
  z
    .string()
    .trim()
    .max(max, { error: `${max} caractères maximum.` })
    .transform((value) => value || null);

const required = (max: number) =>
  z
    .string()
    .trim()
    .min(1, { error: "Ce champ est obligatoire." })
    .max(max, { error: `${max} caractères maximum.` });

const ContractSchema = z.enum(["alternance", "stage", "both"]);

/** Step 1: one click on the kind of contract (docs/QUESTIONS.md C92). */
export async function saveContract(formData: FormData): Promise<void> {
  const parsed = ContractSchema.safeParse(read(formData, "value"));
  if (!parsed.success) redirect("/onboarding/1");
  const { supabase, userId } = await onboardingContext(formData);
  const values = {
    target_contract: parsed.data,
    contract_chosen_at: new Date().toISOString(),
  };
  if (userId) {
    const { error } = await supabase.from("profiles").update(values).eq("user_id", userId);
    if (error) log.error("contract_update_failed", { code: error.code });
  } else {
    await saveDraft(values);
  }
  redirect("/onboarding/2");
}

/** Step 2: the domain is stored as its label, the field the account page shows as free text. */
export async function saveDomain(formData: FormData): Promise<void> {
  const domain = findDomain(read(formData, "value"));
  if (!domain) redirect("/onboarding/2");
  const { supabase, userId } = await onboardingContext(formData);
  if (userId) {
    const { error } = await supabase
      .from("profiles")
      .update({ domain_free_text: domain.label })
      .eq("user_id", userId);
    if (error) log.error("domain_update_failed", { code: error.code });
  } else {
    await saveDraft({ domain_free_text: domain.label });
  }
  redirect("/onboarding/3");
}

const LevelSchema = z.enum(["bac", "bac+2", "bac+3", "bac+4", "bac+5"]);

/** Step 4: the level of the course being prepared, one click. */
export async function saveLevel(formData: FormData): Promise<void> {
  const parsed = LevelSchema.safeParse(read(formData, "value"));
  if (!parsed.success) redirect("/onboarding/4");
  const { supabase, userId } = await onboardingContext(formData);
  if (userId) {
    const { error } = await supabase
      .from("profiles")
      .update({ diploma_level: parsed.data })
      .eq("user_id", userId);
    if (error) log.error("level_update_failed", { code: error.code });
  } else {
    await saveDraft({ diploma_level: parsed.data });
  }
  redirect("/onboarding/5");
}

const IdentitySchema = z.object({ first_name: required(80), last_name: required(80) });

/** Step 6 for a student who already had an account: only the name is missing. */
export async function saveIdentity(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = IdentitySchema.safeParse({
    first_name: read(formData, "first_name"),
    last_name: read(formData, "last_name"),
  });
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };
  const supabase = await createClient();
  const userId = await requireUserId(supabase);
  const { error } = await supabase.from("profiles").update(parsed.data).eq("user_id", userId);
  if (error) {
    log.error("identity_update_failed", { code: error.code });
    return { error: GENERIC_ERROR };
  }
  redirect(`/onboarding/${DOCUMENTS_STEP}`);
}

const ProfileSchema = z.object({
  first_name: required(80),
  last_name: required(80),
  phone: z
    .string()
    .trim()
    .refine((value) => value === "" || PHONE.test(value), {
      error: "Numéro invalide, par exemple 06 12 34 56 78.",
    })
    .transform((value) => value || null),
  // School and course are optional since the questionnaire became clicks only (C92).
  school: optional(120),
  degree_label: optional(120),
  diploma_level: z.enum(["bac", "bac+2", "bac+3", "bac+4", "bac+5"], {
    error: "Choisissez le niveau du diplôme préparé.",
  }),
  target_contract: z.enum(["alternance", "stage", "both"], {
    error: "Choisissez un type de contrat.",
  }),
  availability_date: z
    .string()
    .trim()
    .refine((value) => value === "" || /^\d{4}-\d{2}-\d{2}$/.test(value), {
      error: "Date invalide.",
    })
    .transform((value) => value || null),
});

export async function saveProfile(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = ProfileSchema.safeParse(
    Object.fromEntries(
      [
        "first_name",
        "last_name",
        "phone",
        "school",
        "degree_label",
        "diploma_level",
        "target_contract",
        "availability_date",
      ].map((key) => [key, read(formData, key)]),
    ),
  );
  if (!parsed.success) return { fieldErrors: toFieldErrors(parsed.error) };
  // Since the questionnaire became clicks only (C92), the long form belongs to the account page.
  const supabase = await createClient();
  const userId = await requireUserId(supabase);
  const { error } = await supabase.from("profiles").update(parsed.data).eq("user_id", userId);
  if (error) {
    log.error("profile_update_failed", { code: error.code });
    return { error: GENERIC_ERROR };
  }
  revalidatePath("/account");
  return { saved: true };
}

const DomainSchema = z
  .string()
  .trim()
  .min(3, { error: "Décrivez votre domaine en quelques mots." })
  .max(500, { error: "500 caractères maximum." });

export async function suggestRome(
  _previous: RomeSuggestState,
  formData: FormData,
): Promise<RomeSuggestState> {
  const parsed = DomainSchema.safeParse(read(formData, "domain_free_text"));
  if (!parsed.success)
    return { fieldErrors: { domain_free_text: parsed.error.issues[0]?.message ?? "" } };
  const text = parsed.data;
  const { supabase, userId, reference } = await onboardingContext(formData);
  const allowed = userId
    ? await allowAction(supabase, "suggest_rome")
    : await allowAnonymousAction("suggest_rome", await headers());
  if (!allowed) return { error: RATE_LIMITED_MESSAGE };
  if (userId) {
    await supabase.from("profiles").update({ domain_free_text: text }).eq("user_id", userId);
  } else {
    await saveDraft({ domain_free_text: text });
  }

  const terms = toSearchTerms(text);
  if (terms.length === 0) {
    return {
      error: "Précisez votre domaine, par exemple « développement web » ou « comptabilité ».",
    };
  }
  const candidates = await reference.rpc("search_rome_candidates", {
    p_terms: terms,
    p_limit: 30,
  });
  if (candidates.error) {
    log.error("rome_search_failed", { code: candidates.error.code });
    return { error: GENERIC_ERROR };
  }
  if (candidates.data.length === 0) {
    return { error: "Aucun métier trouvé pour ces mots. Essayez d’autres termes." };
  }
  const diplomaLabel = userId
    ? (await supabase.from("profiles").select("degree_label").eq("user_id", userId).single()).data
        ?.degree_label
    : (await readDraft()).degree_label;
  const result = await suggestRomeCodes(
    { text, candidates: candidates.data, diplomaLabel: diplomaLabel ?? null },
    { client: getAnthropicClient(), model: getModels().light, logger: log },
  );
  log.info("rome_suggested", {
    source: result.source,
    count: result.suggestions.length,
    ...result.usage,
  });
  return { suggestions: result.suggestions, source: result.source };
}

const RomeSelectionSchema = z
  .array(z.string().regex(/^[A-Z]\d{4}$/))
  .min(1, { error: "Choisis au moins un métier." })
  .max(5, { error: "5 métiers au maximum." });

export async function saveRome(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = RomeSelectionSchema.safeParse([
    ...new Set(formData.getAll("rome_codes").map(String)),
  ]);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  const { supabase, userId, reference } = await onboardingContext(formData);
  const known = await reference
    .from("rome_codes")
    .select("code, rome_version")
    .in("code", parsed.data)
    .eq("is_active", true);
  if (known.error || known.data.length !== parsed.data.length) {
    return { error: "Un des métiers choisis n’existe pas dans la nomenclature officielle." };
  }
  const values = {
    rome_codes: parsed.data,
    rome_version: Math.max(...known.data.map((row) => row.rome_version)),
  };
  if (userId) {
    const { error } = await supabase.from("profiles").update(values).eq("user_id", userId);
    if (error) {
      log.error("rome_update_failed", { code: error.code });
      return { error: GENERIC_ERROR };
    }
  } else {
    await saveDraft(values);
  }
  if (userId && read(formData, "mode") === "account") {
    await requestOffersRefresh(userId);
    revalidatePath("/account");
    return { saved: true };
  }
  redirect("/onboarding/4");
}

const AddressSchema = z.object({
  label: z.string().trim().min(3).max(200),
  citycode: z.string().regex(/^[0-9][0-9AB][0-9]{3}$/),
});

type PlaceValues = {
  location_label: string;
  location_lat: number;
  location_lng: number;
  insee_code: string | null;
  search_radius_km: number;
};

function readRadius(formData: FormData): number {
  const value = Number(read(formData, "radius"));
  return (RADIUS_OPTIONS as readonly number[]).includes(value) ? value : DEFAULT_RADIUS_KM;
}

/**
 * Step 5, in three shapes (docs/QUESTIONS.md C92): a city of the list, which calls nothing,
 * the position of the browser, read back through the geocoder, or a typed address.
 */
export async function saveLocation(_previous: FormState, formData: FormData): Promise<FormState> {
  const radius = readRadius(formData);
  const { supabase, userId } = await onboardingContext(formData);
  const preset = findPresetCity(read(formData, "city"));
  let values: PlaceValues | null = preset
    ? {
        location_label: preset.label,
        location_lat: preset.lat,
        location_lng: preset.lng,
        insee_code: preset.insee,
        search_radius_km: radius,
      }
    : null;

  if (!values) {
    if (!userId && !(await allowAnonymousAction("save_location", await headers()))) {
      return { error: RATE_LIMITED_MESSAGE };
    }
    const lat = Number(read(formData, "lat"));
    const lng = Number(read(formData, "lng"));
    const fromPosition =
      read(formData, "lat") !== "" && Number.isFinite(lat) && Number.isFinite(lng);
    const address = fromPosition
      ? null
      : AddressSchema.safeParse({
          label: read(formData, "label"),
          citycode: read(formData, "citycode"),
        });
    if (address && !address.success) {
      return { error: "Choisis une ville de la liste ou une adresse proposée." };
    }
    let place;
    try {
      place = fromPosition ? await reversePlace(lat, lng) : await resolvePlace(address!.data!);
    } catch (error) {
      log.warn("geocoding_unavailable", {
        status: error instanceof ExternalApiError ? error.status : null,
      });
      return { error: "Le service d’adresses ne répond pas. Réessaie dans un instant." };
    }
    if (!place) {
      return {
        error: fromPosition
          ? "On n’a pas reconnu ta position. Choisis une ville."
          : "Adresse introuvable. Choisis une proposition de la liste.",
      };
    }
    values = {
      location_label: place.label,
      location_lat: place.lat,
      location_lng: place.lng,
      insee_code: place.citycode,
      search_radius_km: radius,
    };
  }

  if (!userId) {
    await saveDraft(values);
    // The account comes right after the questions (docs/QUESTIONS.md C91).
    redirect(ACCOUNT_STEP_PATH);
  }
  const { error } = await supabase.from("profiles").update(values).eq("user_id", userId);
  if (error) {
    log.error("location_update_failed", { code: error.code });
    return { error: GENERIC_ERROR };
  }
  if (read(formData, "mode") === "account") {
    await requestOffersRefresh(userId);
    revalidatePath("/account");
    return { saved: true };
  }
  redirect(`/onboarding/${ACCOUNT_STEP}`);
}

type Kind = "cv" | "cover_letter_base";

/** Makes the new document the current one, and deletes the previous files (data minimisation). */
async function replaceCurrentDocument(
  supabase: SupabaseClient<Database>,
  userId: string,
  row: Omit<TablesInsert<"documents">, "user_id" | "is_current"> & { kind: Kind },
): Promise<boolean> {
  const previous = await supabase
    .from("documents")
    .select("id, storage_path")
    .eq("user_id", userId)
    .eq("kind", row.kind)
    .eq("is_current", true);
  if (previous.error) return false;
  const ids = previous.data.map((d) => d.id);
  if (ids.length > 0) {
    const cleared = await supabase.from("documents").update({ is_current: false }).in("id", ids);
    if (cleared.error) return false;
  }
  const inserted = await supabase
    .from("documents")
    .insert({ ...row, user_id: userId, is_current: true });
  if (inserted.error) {
    log.error("document_insert_failed", { code: inserted.error.code });
    return false;
  }
  const oldFiles = previous.data.flatMap((d) => (d.storage_path ? [d.storage_path] : []));
  if (oldFiles.length > 0) await supabase.storage.from("documents").remove(oldFiles);
  if (ids.length > 0) await supabase.from("documents").delete().in("id", ids);
  return true;
}

const RegisterSchema = z.object({
  kind: z.enum(["cv", "cover_letter_base"]),
  path: z.string().max(300),
  originalName: z.string().trim().min(1).max(200),
  mimeType: z.enum([DOCUMENT_MIME_TYPES.pdf, DOCUMENT_MIME_TYPES.docx]),
  size: z.number().int().positive().max(MAX_DOCUMENT_BYTES),
});

/** Called after the browser uploaded a file into the private bucket, in the user's folder. */
export async function registerDocument(
  input: z.input<typeof RegisterSchema>,
): Promise<DocumentResult> {
  const parsed = RegisterSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Fichier non pris en charge." };
  const { kind, path, originalName, mimeType, size } = parsed.data;
  if (kind === "cv" && mimeType !== DOCUMENT_MIME_TYPES.pdf) {
    return { ok: false, error: "Le CV doit être au format PDF." };
  }
  const supabase = await createClient();
  const userId = await requireUserId(supabase);
  if (!(await allowAction(supabase, "upload_document")))
    return { ok: false, error: RATE_LIMITED_MESSAGE };
  const folder = `${userId}/${kind === "cv" ? "cv" : "letter"}/`;
  if (!path.startsWith(folder) || path.includes(".."))
    return { ok: false, error: "Fichier non pris en charge." };

  const download = await supabase.storage.from("documents").download(path);
  if (download.error)
    return { ok: false, error: "Le fichier n’a pas été retrouvé. Réessayez l’envoi." };
  let text: string;
  try {
    text = (await extractDocumentText(new Uint8Array(await download.data.arrayBuffer()), mimeType))
      .text;
  } catch (error) {
    await supabase.storage.from("documents").remove([path]);
    if (error instanceof ValidationError) return { ok: false, error: error.message };
    log.error("extraction_failed", { kind, error });
    return { ok: false, error: GENERIC_ERROR };
  }
  const saved = await replaceCurrentDocument(supabase, userId, {
    kind,
    storage_path: path,
    original_filename: originalName,
    mime_type: mimeType,
    size_bytes: size,
    extracted_text: text,
  });
  if (!saved) return { ok: false, error: GENERIC_ERROR };
  revalidatePath(`/onboarding/${DOCUMENTS_STEP}`);
  revalidatePath("/account");
  return { ok: true };
}

const LetterTextSchema = z
  .string()
  .trim()
  .min(200, { error: "Votre lettre semble trop courte : 200 caractères minimum." })
  .max(8_000, { error: "8 000 caractères maximum." });

export async function saveLetterText(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = LetterTextSchema.safeParse(read(formData, "letter"));
  if (!parsed.success) return { fieldErrors: { letter: parsed.error.issues[0]?.message ?? "" } };
  const text = normalizeExtractedText(parsed.data);
  const supabase = await createClient();
  const userId = await requireUserId(supabase);
  const saved = await replaceCurrentDocument(supabase, userId, {
    kind: "cover_letter_base",
    storage_path: null,
    original_filename: null,
    mime_type: DOCUMENT_MIME_TYPES.text,
    size_bytes: new TextEncoder().encode(text).byteLength,
    extracted_text: text,
  });
  if (!saved) return { error: GENERIC_ERROR };
  revalidatePath(`/onboarding/${DOCUMENTS_STEP}`);
  revalidatePath("/account");
  return { saved: true };
}

export type FinishResult = { ok: true } | { ok: false; error: string };

/**
 * Runs the real work behind the analysis screen (docs/QUESTIONS.md C93): the bonus, the
 * completion flag and the first search. The screen navigates once it answers; a missing
 * answer sends the student back to its question.
 */
export async function finishOnboarding(): Promise<FinishResult> {
  const supabase = await createClient();
  const userId = await requireUserId(supabase);
  const { snapshot } = await loadOnboarding(supabase, userId);
  const next = firstIncompleteStep(snapshot);
  if (next < LAST_STEP) redirect(`/onboarding/${next}`);

  const bonus = await supabase.rpc("grant_signup_bonus");
  if (bonus.error) log.error("signup_bonus_failed", { code: bonus.error.code });
  const { error } = await supabase
    .from("profiles")
    .update({ onboarding_completed: true })
    .eq("user_id", userId);
  if (error) {
    log.error("onboarding_completion_failed", { code: error.code });
    return { ok: false, error: "L’analyse n’a pas abouti. Réessaie dans un instant." };
  }
  const refresh = await requestOffersRefresh(userId);
  log.info("onboarding_completed", { refresh });
  await trackServerEvent(EVENTS.onboardingDone);
  return { ok: true };
}

/** The student skips the CV and the letter (C89); both can be added later from the account. */
export async function skipDocuments(): Promise<void> {
  const supabase = await createClient();
  const userId = await requireUserId(supabase);
  const { error } = await supabase
    .from("profiles")
    .update({ documents_skipped_at: new Date().toISOString() })
    .eq("user_id", userId);
  if (error) {
    log.error("documents_skip_failed", { code: error.code });
    redirect(`/onboarding/${DOCUMENTS_STEP}`);
  }
  redirect(`/onboarding/${LAST_STEP}`);
}
