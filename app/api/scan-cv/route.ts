import { NextResponse, type NextRequest } from "next/server";

import { allowAnonymousAction } from "@/lib/anon-rate-limit";
import { currentUserId } from "@/lib/auth/session";
import { scanCvText, scanSummary } from "@/lib/cv/scan";
import {
  DOCUMENT_MIME_TYPES,
  extractDocumentText,
  MAX_EXTRACTED_CHARS,
} from "@/lib/documents/extract-text";
import { isSupabaseConfigured } from "@/lib/env";
import { ValidationError } from "@/lib/errors";
import { logger } from "@/lib/logger";
import { saveDraft, readDraft } from "@/lib/onboarding/draft-cookie";
import { draftSnapshot } from "@/lib/onboarding/draft";
import { bestDomainForCandidates } from "@/lib/onboarding/domains";
import { ANALYSIS_PATH, firstIncompleteStep, VISITOR_LAST_STEP } from "@/lib/onboarding/state";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";

/**
 * Reads a CV dropped on the landing page (docs/QUESTIONS.md C95) and fills what it can of
 * the questionnaire: level of study, field, jobs, kind of contract, city. The file itself
 * is never stored: only the answers it suggests are kept, and the student corrects them.
 */

/** Vercel refuses request bodies over 4.5 MB: the scan asks for less. */
const MAX_SCAN_BYTES = 4 * 1024 * 1024;
const ROME_CANDIDATES = 30;
const log = logger.child({ area: "cv_scan" });

function fail(error: string, status: number) {
  return NextResponse.json({ ok: false, error }, { status });
}

export async function POST(request: NextRequest) {
  if (!isSupabaseConfigured()) return fail("Le service n’est pas disponible.", 503);
  const supabase = await createClient();
  const userId = await currentUserId(supabase);
  if (!userId && !(await allowAnonymousAction("scan_cv", request.headers))) {
    return fail("Trop de CV analysés en peu de temps. Réessaie dans quelques minutes.", 429);
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    // Not a file upload at all: answer like any other missing file.
    return fail("Choisis un fichier PDF ou Word.", 400);
  }
  const file = form.get("cv");
  if (!(file instanceof File)) return fail("Choisis un fichier PDF ou Word.", 400);
  if (file.size > MAX_SCAN_BYTES) return fail("Ton CV dépasse 4 Mo.", 400);
  const mimeType =
    file.type === DOCUMENT_MIME_TYPES.pdf || file.type === DOCUMENT_MIME_TYPES.docx
      ? file.type
      : /\.pdf$/i.test(file.name)
        ? DOCUMENT_MIME_TYPES.pdf
        : /\.docx$/i.test(file.name)
          ? DOCUMENT_MIME_TYPES.docx
          : null;
  if (!mimeType) return fail("Formats acceptés : PDF ou Word (.docx).", 400);

  let text: string;
  try {
    const extracted = await extractDocumentText(new Uint8Array(await file.arrayBuffer()), mimeType);
    text = extracted.text.slice(0, MAX_EXTRACTED_CHARS);
  } catch (error) {
    if (error instanceof ValidationError) return fail(error.message, 400);
    log.error("extraction_failed", { error });
    return fail("On n’a pas réussi à lire ce fichier. Réessaie avec un PDF.", 400);
  }
  // The text of the CV is read here and dropped: nothing of it is stored without an account.
  const scan = scanCvText(text);

  const db = createAdminClient();
  let domain = null as ReturnType<typeof bestDomainForCandidates>;
  if (scan.terms.length > 0) {
    const candidates = await db.rpc("search_rome_candidates", {
      p_terms: scan.terms,
      p_limit: ROME_CANDIDATES,
    });
    const codes = (candidates.data ?? []).map((row) => row.code);
    if (codes.length > 0) {
      const rows = await db
        .from("rome_codes")
        .select("code, domaine_professionnel")
        .in("code", codes);
      domain = bestDomainForCandidates(
        (rows.data ?? []).map((row) => ({
          code: row.code,
          professionalDomain: row.domaine_professionnel,
        })),
      );
    }
  }

  const summary = scanSummary({
    diplomaLevel: scan.diplomaLevel,
    domainLabel: domain?.domain.label ?? null,
    city: scan.city?.label ?? null,
  });
  const answers = {
    ...(scan.contract
      ? {
          target_contract:
            scan.contract === "alternance" ? ("alternance" as const) : ("both" as const),
          contract_chosen_at: new Date().toISOString(),
        }
      : {}),
    ...(scan.diplomaLevel ? { diploma_level: scan.diplomaLevel } : {}),
    ...(domain ? { domain_free_text: domain.domain.label } : {}),
    ...(domain && domain.codes.length > 0 ? { rome_codes: domain.codes } : {}),
    ...(scan.city
      ? {
          location_label: scan.city.label,
          location_lat: scan.city.lat,
          location_lng: scan.city.lng,
          insee_code: scan.city.insee,
          search_radius_km: 30,
        }
      : {}),
  };

  const draft = await saveDraft({ ...answers, ...(summary ? { scan_summary: summary } : {}) });
  if (userId) {
    const { error } = await supabase.from("profiles").update(answers).eq("user_id", userId);
    if (error) log.warn("profile_update_failed", { code: error.code });
  }
  log.info("cv_scanned", {
    level: scan.diplomaLevel,
    contract: scan.contract,
    domain: domain?.domain.id ?? null,
    city: scan.city?.id ?? null,
    jobs: domain?.codes.length ?? 0,
  });

  const step = firstIncompleteStep(draftSnapshot(userId ? await readDraft() : draft));
  const next = step > VISITOR_LAST_STEP ? ANALYSIS_PATH : `/onboarding/${step}`;
  return NextResponse.json({ ok: true, next, summary });
}
