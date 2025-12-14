import type { CatalogFile, CatalogItem } from "@shared/schema";
import { extractSearchTokens, normalizeText } from "./text-utils";

const SNIPPET_LIMIT = resolveSnippetLimit(process.env.CATALOG_SNIPPET_LIMIT, 220);
const FOCUSED_KEYWORDS = [
  "composicao",
  "composição",
  "composicao quimica",
  "quimica",
  "quimico",
  "ingrediente",
  "ingredientes",
  "principio",
  "principio ativo",
  "ativo",
  "componentes",
  "componente",
  "formulacao",
  "formula",
];
const NORMALIZED_FOCUSED_KEYWORDS = FOCUSED_KEYWORDS.map((keyword) => normalizeText(keyword));
const MAX_FOCUSED_SEGMENTS = 3;

function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

export function buildCatalogItemEmbeddingContent(item: CatalogItem): string {
  const tags = item.tags?.length ? item.tags.join(", ") : "sem tags";
  const base = `${item.name}. Categoria: ${item.category}. Fabricante: ${item.manufacturer}.`;
  const price = Number.isFinite(item.price) ? ` Preço aproximado: R$${item.price.toFixed(2)}.` : "";

  return normalizeWhitespace(`${base}${price} Tags: ${tags}. Descrição: ${item.description}`);
}

export function buildCatalogFileEmbeddingContent(file: CatalogFile, item?: CatalogItem): string {
  const header = item
    ? `${item.name} (${item.category}) — anexo ${file.originalName}.`
    : `Anexo ${file.originalName}.`;

  const preview = file.textPreview || "";
  return normalizeWhitespace(`${header} ${preview}`);
}

export function buildCatalogFileEmbeddingChunkContent(
  file: Pick<CatalogFile, "originalName">,
  chunk: string,
  item?: Pick<CatalogItem, "name" | "category">,
): string {
  const header = item
    ? `${item.name} (${item.category}) — anexo ${file.originalName}.`
    : `Anexo ${file.originalName}.`;

  return normalizeWhitespace(`${header} ${chunk}`);
}

export function buildSnippet(content: string, limit = SNIPPET_LIMIT): string {
  const normalized = normalizeWhitespace(content);
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit - 1)}…`;
}

export function buildFocusedSnippet(content: string, query?: string, limit = SNIPPET_LIMIT): string {
  if (!query) return buildSnippet(content, limit);

  const focusTokens = collectFocusTokens(query);
  if (focusTokens.length === 0) {
    return buildSnippet(content, limit);
  }

  const segments = splitContentSegments(content);
  const matchedSegments: string[] = [];

  for (const segment of segments) {
    const normalizedSegment = normalizeText(segment);
    if (focusTokens.some((token) => normalizedSegment.includes(token))) {
      matchedSegments.push(normalizeWhitespace(segment));
    }
    if (matchedSegments.length >= MAX_FOCUSED_SEGMENTS) break;
  }

  if (matchedSegments.length === 0) {
    return buildSnippet(content, limit);
  }

  const combined = matchedSegments.join(" … ");
  if (combined.length <= limit) {
    return combined;
  }
  return `${combined.slice(0, Math.max(0, limit - 1))}…`;
}

function resolveSnippetLimit(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.min(parsed, 4000);
  }
  return fallback;
}

function collectFocusTokens(query: string): string[] {
  const normalizedQuery = normalizeText(query);
  const tokens = new Set(
    extractSearchTokens(query, { maxTokens: 12 }).map((token) => normalizeText(token)),
  );

  for (const keyword of NORMALIZED_FOCUSED_KEYWORDS) {
    if (normalizedQuery.includes(keyword)) {
      tokens.add(keyword);
    }
  }

  const focus = Array.from(tokens).filter((token) =>
    NORMALIZED_FOCUSED_KEYWORDS.some((keyword) => keyword.includes(token) || token.includes(keyword)),
  );

  return focus;
}

function splitContentSegments(content: string): string[] {
  const normalizedLineBreaks = content.replace(/\r\n/g, "\n");
  const blocks = normalizedLineBreaks
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  const segments: string[] = [];
  for (const block of blocks) {
    const sentences = block.split(/(?:(?:\.|\?|!)\s+)/);
    for (const sentence of sentences) {
      const trimmed = sentence.trim();
      if (trimmed) {
        segments.push(trimmed);
      }
    }
  }

  return segments;
}
