"use client";

import { createClient } from "@/lib/supabase/client";

import { registerDocument, type DocumentResult } from "../actions";

/** Files go straight from the browser to the private bucket, then the row is registered. */

export const PDF = "application/pdf";
export const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
export const MAX_BYTES = 5 * 1024 * 1024;

export type DocumentKind = "cv" | "cover_letter_base";

export function mimeTypeOf(file: File): string {
  if (file.type) return file.type;
  if (/\.pdf$/i.test(file.name)) return PDF;
  if (/\.docx$/i.test(file.name)) return DOCX;
  return "";
}

export async function uploadDocument(
  userId: string,
  kind: DocumentKind,
  file: File,
): Promise<DocumentResult> {
  const mimeType = mimeTypeOf(file);
  if (mimeType !== PDF && mimeType !== DOCX) {
    return { ok: false, error: "Formats acceptés : PDF ou Word (.docx)." };
  }
  if (file.size > MAX_BYTES) return { ok: false, error: "Le fichier dépasse 5 Mo." };
  const extension = mimeType === PDF ? "pdf" : "docx";
  const path = `${userId}/${kind === "cv" ? "cv" : "letter"}/${crypto.randomUUID()}.${extension}`;
  const uploaded = await createClient()
    .storage.from("documents")
    .upload(path, file, { contentType: mimeType });
  if (uploaded.error) return { ok: false, error: "L’envoi du fichier a échoué. Réessaie." };
  return registerDocument({
    kind,
    path,
    originalName: file.name,
    mimeType,
    size: file.size,
  });
}
