import type { Express } from "express";
import { parse as parseCsv } from "csv-parse/sync";
import JSZip from "jszip";
import { XMLParser } from "fast-xml-parser";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { parseOptionalPositiveInt } from "./text-chunking";
import { extractPdfPreviewWithPdfJsWithStats, type PdfPreviewEngine } from "./pdfjs-preview";

const DEFAULT_MAX_PREVIEW_LENGTH = Number.POSITIVE_INFINITY;
const DEFAULT_PDF_PREVIEW_ENGINE: PdfPreviewEngine = "pdfjs+fallback";
const DEFAULT_PDF_PREVIEW_MAX_PAGES = 8;
const DEFAULT_PDF_PREVIEW_MAX_CHARS = 30_000;
const DEFAULT_PDF_PREVIEW_TIMEOUT_MS = 6_000;

function isPdfPreviewLoggingEnabled(): boolean {
  const value = process.env.PDF_PREVIEW_LOG_ENABLED;
  if (value == null) return true;
  return value !== "false" && value !== "0";
}

function sanitizeText(text: string | undefined, maxLength: number = DEFAULT_MAX_PREVIEW_LENGTH): string | undefined {
  if (!text) return undefined;

  const normalized = text
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  if (!normalized) return undefined;

  if (Number.isFinite(maxLength) && maxLength > 0) {
    return normalized.slice(0, maxLength);
  }

  return normalized;
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

async function extractPdfPreview(buffer: Buffer): Promise<{ text: string | undefined; totalPages: number } > {
  const parser = new PDFParse({ data: buffer });
  const parsed = await parser.getText();
  await parser.destroy();

  return {
    text: parsed.text,
    totalPages: typeof parsed.total === "number" && Number.isFinite(parsed.total) ? parsed.total : 0,
  };
}

function getPdfPreviewEngine(): PdfPreviewEngine {
  const raw = (process.env.PDF_PREVIEW_ENGINE ?? DEFAULT_PDF_PREVIEW_ENGINE).toLowerCase().trim();
  if (raw === "pdf-parse" || raw === "pdfparse") return "pdf-parse";
  if (raw === "pdfjs") return "pdfjs";
  if (raw === "pdfjs+fallback" || raw === "pdfjs-fallback" || raw === "pdfjs_fallback") return "pdfjs+fallback";
  return DEFAULT_PDF_PREVIEW_ENGINE;
}

function getPdfPreviewLimits(maxLength: number) {
  const maxPages = parseOptionalPositiveInt(process.env.PDF_PREVIEW_MAX_PAGES) ?? DEFAULT_PDF_PREVIEW_MAX_PAGES;
  const maxCharsFromEnv = parseOptionalPositiveInt(process.env.PDF_PREVIEW_MAX_CHARS) ?? DEFAULT_PDF_PREVIEW_MAX_CHARS;
  const timeoutMs = parseOptionalPositiveInt(process.env.PDF_PREVIEW_TIMEOUT_MS) ?? DEFAULT_PDF_PREVIEW_TIMEOUT_MS;

  const maxChars = Number.isFinite(maxLength) && maxLength > 0
    ? Math.min(Math.floor(maxLength), maxCharsFromEnv)
    : maxCharsFromEnv;

  return {
    maxPages,
    maxChars,
    timeoutMs,
  };
}

async function extractPdfPreviewWithEngine(buffer: Buffer, maxLength: number): Promise<string | undefined> {
  const engine = getPdfPreviewEngine();
  const limits = getPdfPreviewLimits(maxLength);
  const loggingEnabled = isPdfPreviewLoggingEnabled();
  const startMs = Date.now();

  if (engine === "pdf-parse") {
    const parsed = await extractPdfPreview(buffer);
    const text = sanitizeText(parsed.text, limits.maxChars);
    if (loggingEnabled) {
      console.log(
        `[CATALOG_PREVIEW] pdf engine=pdf-parse pages=${parsed.totalPages} chars=${text?.length ?? 0} durationMs=${Date.now() - startMs}`,
      );
    }
    return text;
  }

  const attemptPdfJs = async () => {
    return await extractPdfPreviewWithPdfJsWithStats(buffer, {
      maxPages: limits.maxPages,
      maxChars: limits.maxChars,
      timeoutMs: limits.timeoutMs,
    });
  };

  if (engine === "pdfjs") {
    const result = await attemptPdfJs();
    const text = sanitizeText(result.text, limits.maxChars);
    if (loggingEnabled) {
      console.log(
        `[CATALOG_PREVIEW] pdf engine=pdfjs pages=${result.pagesProcessed} chars=${text?.length ?? 0} tables=${result.usedMarkdownTable} durationMs=${result.durationMs} (limits pages=${limits.maxPages} chars=${limits.maxChars} timeoutMs=${limits.timeoutMs})`,
      );
    }
    return text;
  }

  try {
    const result = await attemptPdfJs();
    const text = sanitizeText(result.text, limits.maxChars);
    if (loggingEnabled) {
      console.log(
        `[CATALOG_PREVIEW] pdf engine=pdfjs+fallback used=pdfjs pages=${result.pagesProcessed} chars=${text?.length ?? 0} tables=${result.usedMarkdownTable} durationMs=${result.durationMs} (limits pages=${limits.maxPages} chars=${limits.maxChars} timeoutMs=${limits.timeoutMs})`,
      );
    }
    return text;
  } catch (error) {
    console.warn("[CATALOG] PDF.js falhou, usando fallback pdf-parse:", error);
    const parsed = await extractPdfPreview(buffer);
    const fallbackText = sanitizeText(parsed.text, limits.maxChars);
    if (loggingEnabled) {
      console.log(
        `[CATALOG_PREVIEW] pdf engine=pdfjs+fallback used=pdf-parse pages=${parsed.totalPages} chars=${fallbackText?.length ?? 0} durationMs=${Date.now() - startMs} (limits pages=${limits.maxPages} chars=${limits.maxChars} timeoutMs=${limits.timeoutMs})`,
      );
    }
    return fallbackText;
  }
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
      return await extractPdfPreviewWithEngine(buffer, maxLength);
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
