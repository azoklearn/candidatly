import { readFileSync } from "node:fs";

import { describe, expect, it } from "vitest";

import {
  DOCUMENT_MIME_TYPES,
  MAX_EXTRACTED_CHARS,
  extractDocumentText,
  normalizeExtractedText,
} from "@/lib/documents/extract-text";
import { ValidationError } from "@/lib/errors";

const fixture = (name: string) =>
  new Uint8Array(readFileSync(new URL(`../../fixtures/documents/${name}`, import.meta.url)));

describe("extractDocumentText", () => {
  it("reads the text of a PDF", async () => {
    const result = await extractDocumentText(fixture("cv.pdf"), DOCUMENT_MIME_TYPES.pdf);
    expect(result.text).toContain("Camille Martin");
    expect(result.text).toContain("TypeScript, React, SQL");
    expect(result.pages).toBe(1);
    expect(result.truncated).toBe(false);
  });

  it("reads a Word document with accents", async () => {
    const result = await extractDocumentText(fixture("letter.docx"), DOCUMENT_MIME_TYPES.docx);
    expect(result.text).toContain("Madame, Monsieur,");
    expect(result.text).toContain("Étudiante en deuxième année de BUT Informatique");
  });

  it("reads pasted text and truncates very long documents", async () => {
    const long = new TextEncoder().encode("Lettre de motivation. ".repeat(2_000));
    const result = await extractDocumentText(long, DOCUMENT_MIME_TYPES.text);
    expect(result.text).toHaveLength(MAX_EXTRACTED_CHARS);
    expect(result.truncated).toBe(true);
  });

  it("rejects scans, fakes, empty files and other formats", async () => {
    await expect(
      extractDocumentText(fixture("image-only.pdf"), DOCUMENT_MIME_TYPES.pdf),
    ).rejects.toThrow(ValidationError);
    await expect(
      extractDocumentText(fixture("letter.docx"), DOCUMENT_MIME_TYPES.pdf),
    ).rejects.toThrow(ValidationError);
    await expect(extractDocumentText(new Uint8Array(), DOCUMENT_MIME_TYPES.pdf)).rejects.toThrow(
      ValidationError,
    );
    await expect(extractDocumentText(fixture("cv.pdf"), "image/png")).rejects.toThrow(
      ValidationError,
    );
  });
});

describe("normalizeExtractedText", () => {
  it("collapses spaces, drops control characters and keeps paragraphs", () => {
    const bell = String.fromCharCode(7);
    const noBreak = String.fromCharCode(160);
    const raw = `  Bon${bell}jour${noBreak}\t le  monde\r\n\r\n\r\n\r\nFin  `;
    expect(normalizeExtractedText(raw)).toBe("Bonjour le monde\n\nFin");
  });
});
