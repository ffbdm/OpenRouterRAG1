import type { Faq } from "@shared/schema";

const SNIPPET_LIMIT = resolveSnippetLimit(process.env.FAQ_SNIPPET_LIMIT, 220);

function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

export function buildFaqEmbeddingContent(faq: Faq): string {
  const content = `Pergunta: ${faq.question}. Resposta: ${faq.answer}.`;
  return normalizeWhitespace(content);
}

export function buildFaqSnippet(content: string, limit = SNIPPET_LIMIT): string {
  const normalized = normalizeWhitespace(content);
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit - 1)}…`;
}

function resolveSnippetLimit(value: string | undefined, fallback: number): number {
  if (!value) return fallback;
  const parsed = Number(value);
  if (Number.isFinite(parsed) && parsed > 0) {
    return Math.min(parsed, 4000);
  }
  return fallback;
}

