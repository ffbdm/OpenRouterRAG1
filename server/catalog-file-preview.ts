import type { Express } from "express";
import { parse as parseCsv } from "csv-parse/sync";
import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

const DEFAULT_MAX_PREVIEW_LENGTH = 2000;

function sanitizeText(text: string | undefined, maxLength: number): string | undefined {
  if (!text) return undefined;

  const normalized = text
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!normalized) return undefined;

  return normalized.slice(0, maxLength);
}

function decodeRtf(buffer: Buffer): string {
  const raw = buffer.toString("utf-8");

  const decodedUnicode = raw.replace(/\\u(-?\d+)\??/g, (_, code) => {
    const parsed = Number.parseInt(code, 10);
    if (Number.isNaN(parsed)) return " ";
    return String.fromCharCode(parsed < 0 ? 65536 + parsed : parsed);
  });

  const decodedHex = decodedUnicode.replace(/\\'([0-9a-fA-F]{2})/g, (_, hex) => {
    const parsed = Number.parseInt(hex, 16);
    return Number.isNaN(parsed) ? " " : String.fromCharCode(parsed);
  });

  const withoutControls = decodedHex.replace(/\\[a-zA-Z]+-?\d* ?/g, " ");
  return withoutControls.replace(/[{}]/g, " ");
}

function extractCsvPreview(buffer: Buffer): string | undefined {
  try {
    const rows = parseCsv(buffer.toString("utf-8"), {
      relaxColumnCount: true,
      skipEmptyLines: true,
      trim: true,
    });

    if (!Array.isArray(rows)) return undefined;

    return rows
      .map((row) => (Array.isArray(row) ? row.join(" ") : String(row ?? "")))
      .join("\n");
  } catch (error) {
    console.warn("[CATALOG] Falha ao interpretar CSV, usando fallback de texto:", error);
    return buffer.toString("utf-8");
  }
}

async function extractDocxPreview(buffer: Buffer): Promise<string | undefined> {
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

async function extractPdfPreview(buffer: Buffer): Promise<string | undefined> {
  const parser = new PDFParse({ data: buffer });
  const parsed = await parser.getText();
  await parser.destroy();

  return parsed.text;
}

async function extractOdtPreview(buffer: Buffer): Promise<string | undefined> {
  const zip = await JSZip.loadAsync(buffer);
  const contentXml = await zip.file("content.xml")?.async("string");
  if (!contentXml) return undefined;

  const parser = new XMLParser({
    ignoreAttributes: true,
    removeNSPrefix: true,
    processEntities: true,
  });

  const parsed = parser.parse(contentXml);
  const parts: string[] = [];

  const collectText = (value: unknown) => {
    if (typeof value === "string") {
      parts.push(value);
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(collectText);
      return;
    }

    if (value && typeof value === "object") {
      Object.values(value as Record<string, unknown>).forEach(collectText);
    }
  };

  collectText(parsed);
  return parts.join(" ");
}

function logParserFailure(mimeType: string, error: unknown) {
  console.warn(`[CATALOG] Falha ao extrair preview (${mimeType}):`, error);
}

export async function extractTextPreview(file: Express.Multer.File, maxLength = DEFAULT_MAX_PREVIEW_LENGTH): Promise<string | undefined> {
  const mimeType = (file.mimetype || "application/octet-stream").toLowerCase();
  const buffer = file.buffer;

  if (!buffer) return undefined;

  try {
    if (mimeType === "text/csv" || mimeType === "application/csv") {
      return sanitizeText(extractCsvPreview(buffer), maxLength);
    }

    if (mimeType.startsWith("text/") || mimeType === "application/json") {
      return sanitizeText(buffer.toString("utf-8"), maxLength);
    }

    if (mimeType === "application/pdf") {
      return sanitizeText(await extractPdfPreview(buffer), maxLength);
    }

    if (mimeType === "application/vnd.openxmlformats-officedocument.wordprocessingml.document" || mimeType === "application/msword") {
      const maybeZip = buffer.subarray(0, 2).toString("utf-8") === "PK";
      if (mimeType === "application/msword" && !maybeZip) {
        return undefined;
      }

      return sanitizeText(await extractDocxPreview(buffer), maxLength);
    }

    if (mimeType === "application/rtf" || mimeType === "text/rtf") {
      return sanitizeText(decodeRtf(buffer), maxLength);
    }

    if (mimeType === "application/vnd.oasis.opendocument.text") {
      return sanitizeText(await extractOdtPreview(buffer), maxLength);
    }
  } catch (error) {
    logParserFailure(mimeType, error);
  }

  return undefined;
}

export { DEFAULT_MAX_PREVIEW_LENGTH };
