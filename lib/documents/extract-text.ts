import mammoth from "mammoth";
import { extractText as extractPdfText, getDocumentProxy } from "unpdf";

import { ValidationError } from "@/lib/errors";

/** Text extraction from CVs and cover letters (brief section 5.1, step 5). */

export const DOCUMENT_MIME_TYPES = {
  pdf: "application/pdf",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  text: "text/plain",
} as const;

export const MAX_DOCUMENT_BYTES = 5 * 1024 * 1024;
export const MAX_EXTRACTED_CHARS = 20_000;
const MIN_READABLE_CHARS = 20;
const NO_BREAK_SPACE = String.fromCharCode(160);

export type ExtractedText = { text: string; truncated: boolean; pages: number | null };

function invalid(message: string): ValidationError {
  return new ValidationError(message, [{ path: "file", message }]);
}

function startsWith(bytes: Uint8Array, signature: string): boolean {
  return [...signature].every((char, index) => bytes[index] === char.charCodeAt(0));
}

/** Removes control characters, keeping tabs and line breaks. */
function stripControlCharacters(value: string): string {
  let output = "";
  for (const char of value) {
    const code = char.codePointAt(0) ?? 0;
    const isControl = (code < 32 && code !== 9 && code !== 10) || code === 127;
    if (!isControl) output += char;
  }
  return output;
}

/** Collapses spaces, keeps paragraphs, removes control characters. */
export function normalizeExtractedText(raw: string): string {
  return stripControlCharacters(raw.replace(/\r\n?/g, "\n"))
    .split(NO_BREAK_SPACE)
    .join(" ")
    .replace(/[ \t]+/g, " ")
    .replace(/ *\n */g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export async function extractDocumentText(
  bytes: Uint8Array,
  mimeType: string,
): Promise<ExtractedText> {
  if (bytes.byteLength === 0) throw invalid("Le fichier est vide.");
  if (bytes.byteLength > MAX_DOCUMENT_BYTES) throw invalid("Le fichier dépasse 5 Mo.");

  let raw: string;
  let pages: number | null = null;
  if (mimeType === DOCUMENT_MIME_TYPES.pdf) {
    if (!startsWith(bytes, "%PDF")) throw invalid("Ce fichier n’est pas un PDF valide.");
    try {
      const pdf = await getDocumentProxy(new Uint8Array(bytes));
      const result = await extractPdfText(pdf, { mergePages: true });
      raw = result.text;
      pages = result.totalPages;
    } catch {
      throw invalid("Ce PDF est illisible.");
    }
  } else if (mimeType === DOCUMENT_MIME_TYPES.docx) {
    if (!startsWith(bytes, "PK")) throw invalid("Ce fichier n’est pas un document Word valide.");
    try {
      raw = (await mammoth.extractRawText({ buffer: Buffer.from(bytes) })).value;
    } catch {
      throw invalid("Ce document Word est illisible.");
    }
  } else if (mimeType === DOCUMENT_MIME_TYPES.text) {
    raw = new TextDecoder("utf-8").decode(bytes);
  } else {
    throw invalid("Format non pris en charge : utilisez un PDF ou un fichier Word (.docx).");
  }

  const text = normalizeExtractedText(raw);
  if (text.length < MIN_READABLE_CHARS) {
    throw invalid(
      "Aucun texte lisible dans ce fichier. S’il s’agit d’un scan, exportez plutôt votre document en PDF depuis votre traitement de texte.",
    );
  }
  return {
    text: text.slice(0, MAX_EXTRACTED_CHARS),
    truncated: text.length > MAX_EXTRACTED_CHARS,
    pages,
  };
}
