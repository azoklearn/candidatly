"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { getAnthropicClient, getModels } from "@/lib/ai/client";
import { EVENTS } from "@/lib/analytics";
import { trackServerEvent } from "@/lib/analytics-server";
import { suggestRomeCodes, toSearchTerms, type RomeSuggestion } from "@/lib/ai/rome-mapping";
import { requireUserId } from "@/lib/auth/session";
import {
  DOCUMENT_MIME_TYPES,
  MAX_DOCUMENT_BYTES,
  extractDocumentText,
  normalizeExtractedText,
} from "@/lib/documents/extract-text";
import { ExternalApiError, ValidationError } from "@/lib/errors";
import { resolvePlace } from "@/lib/geocoding/geocode";
import { requestOffersRefresh } from "@/lib/offers/request-refresh";
import { logger } from "@/lib/logger";
import { allowAction, RATE_LIMITED_MESSAGE } from "@/lib/rate-limit";
import { firstIncompleteStep, LAST_STEP } from "@/lib/onboarding/state";
import type { Database, TablesInsert } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

import { loadOnboarding } from "./data";

export type FormState = { error?: string; fieldErrors?: Record<string, string>; saved?: boolean };
export type RomeSuggestState = FormState & {
  suggestions?: RomeSuggestion[];
  source?: "llm" | "search";
};
export type DocumentResult = { ok: true } | { ok: false; error: string };

const GENERIC_ERROR = "Une erreur est survenue. Réessayez dans un instant.";
const PHONE = /^(?:\+33\s?|0)[1-9](?:[\s.-]?\d{2}){4}$/;
const log = logger.child({ area: "onboarding" });

const read = (formData: FormData, key: string) => String(formData.get(key) ?? "");

function toFieldErrors(error: z.ZodError): Record<string, string> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = String(issue.path[0] ?? "form");
    result[key] ??= issue.message;
  }
  return result;
}

const required = (max: number) =>
  z
    .string()
    .trim()
    .min(1, { error: "Ce champ est obligatoire." })
    .max(max, { error: `${max} caractères maximum.` });

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
  school: required(120),
  degree_label: required(120),
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
  const supabase = await createClient();
  const userId = await requireUserId(supabase);
  const { error } = await supabase.from("profiles").update(parsed.data).eq("user_id", userId);
  if (error) {
    log.error("profile_update_failed", { code: error.code });
    return { error: GENERIC_ERROR };
  }
  if (read(formData, "mode") === "account") {
    revalidatePath("/account");
    return { saved: true };
  }
  redirect("/onboarding/3");
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
  const supabase = await createClient();
  const userId = await requireUserId(supabase);
  if (!(await allowAction(supabase, "suggest_rome"))) return { error: RATE_LIMITED_MESSAGE };
  await supabase.from("profiles").update({ domain_free_text: text }).eq("user_id", userId);

  const terms = toSearchTerms(text);
  if (terms.length === 0) {
    return {
      error: "Précisez votre domaine, par exemple « développement web » ou « comptabilité ».",
    };
  }
  const candidates = await supabase.rpc("search_rome_candidates", { p_terms: terms, p_limit: 30 });
  if (candidates.error) {
    log.error("rome_search_failed", { code: candidates.error.code });
    return { error: GENERIC_ERROR };
  }
  if (candidates.data.length === 0) {
    return { error: "Aucun métier trouvé pour ces mots. Essayez d’autres termes." };
  }
  const profile = await supabase
    .from("profiles")
    .select("degree_label")
    .eq("user_id", userId)
    .single();
  const result = await suggestRomeCodes(
    { text, candidates: candidates.data, diplomaLabel: profile.data?.degree_label ?? null },
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
  .min(1, { error: "Choisissez au moins un métier." })
  .max(5, { error: "Choisissez 5 métiers au maximum." });

export async function saveRome(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = RomeSelectionSchema.safeParse([
    ...new Set(formData.getAll("rome_codes").map(String)),
  ]);
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? GENERIC_ERROR };
  const supabase = await createClient();
  const userId = await requireUserId(supabase);
  const known = await supabase
    .from("rome_codes")
    .select("code, rome_version")
    .in("code", parsed.data)
    .eq("is_active", true);
  if (known.error || known.data.length !== parsed.data.length) {
    return { error: "Un des métiers choisis n’existe pas dans la nomenclature officielle." };
  }
  const { error } = await supabase
    .from("profiles")
    .update({
      rome_codes: parsed.data,
      rome_version: Math.max(...known.data.map((row) => row.rome_version)),
    })
    .eq("user_id", userId);
  if (error) {
    log.error("rome_update_failed", { code: error.code });
    return { error: GENERIC_ERROR };
  }
  if (read(formData, "mode") === "account") {
    await requestOffersRefresh(userId);
    revalidatePath("/account");
    return { saved: true };
  }
  redirect("/onboarding/4");
}

const RADIUS_OPTIONS = [10, 20, 30, 50, 100] as const;
const LocationSchema = z.object({
  label: z.string().trim().min(3).max(200),
  citycode: z.string().regex(/^[0-9][0-9AB][0-9]{3}$/),
  radius: z.coerce
    .number()
    .refine((value) => (RADIUS_OPTIONS as readonly number[]).includes(value)),
});

export async function saveLocation(_previous: FormState, formData: FormData): Promise<FormState> {
  const parsed = LocationSchema.safeParse({
    label: read(formData, "label"),
    citycode: read(formData, "citycode"),
    radius: read(formData, "radius"),
  });
  if (!parsed.success)
    return { error: "Choisissez une adresse ou une ville dans la liste proposée." };
  let place;
  try {
    place = await resolvePlace({ label: parsed.data.label, citycode: parsed.data.citycode });
  } catch (error) {
    log.warn("geocoding_unavailable", {
      status: error instanceof ExternalApiError ? error.status : null,
    });
    return { error: "Le service d’adresses ne répond pas. Réessayez dans un instant." };
  }
  if (!place) return { error: "Adresse introuvable. Choisissez une proposition de la liste." };
  const supabase = await createClient();
  const userId = await requireUserId(supabase);
  const { error } = await supabase
    .from("profiles")
    .update({
      location_label: place.label,
      location_lat: place.lat,
      location_lng: place.lng,
      insee_code: place.citycode,
      search_radius_km: parsed.data.radius,
    })
    .eq("user_id", userId);
  if (error) {
    log.error("location_update_failed", { code: error.code });
    return { error: GENERIC_ERROR };
  }
  if (read(formData, "mode") === "account") {
    await requestOffersRefresh(userId);
    revalidatePath("/account");
    return { saved: true };
  }
  redirect("/onboarding/5");
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
  revalidatePath("/onboarding/5");
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
  revalidatePath("/onboarding/5");
  revalidatePath("/account");
  return { saved: true };
}

export async function finishOnboarding(): Promise<void> {
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
    redirect(`/onboarding/${LAST_STEP}?error=1`);
  }
  const refresh = await requestOffersRefresh(userId);
  log.info("onboarding_completed", { refresh });
  await trackServerEvent(EVENTS.onboardingDone);
  // What the search found, then the plans (C82).
  redirect("/forfait");
}
