import type { Faq } from "@shared/schema";
import { extractSearchTokens, normalizeText } from "./text-utils";
import { buildFaqSnippet } from "./faq-embedding-utils";

export type FaqSearchSource = "embedding" | "lexical";

export type FaqHybridHit = {
  item: Faq;
  source: FaqSearchSource;
  score?: number;
  lexicalScore?: number;
  snippet?: string;
};

export type FaqHybridSearchResult = {
  results: FaqHybridHit[];
  vectorCount: number;
  lexicalCount: number;
  embeddingUsed: boolean;
  fallbackReason?: string;
  timings: {
    vectorMs: number;
    lexicalMs: number;
    mergeMs: number;
    totalMs: number;
  };
};

export function clampFaqLimit(limit: number, fallback = 5, max = 20): number {
  if (!Number.isFinite(limit) || limit <= 0) return fallback;
  return Math.min(max, Math.max(1, Math.floor(limit)));
}

type MergeOptions = {
  enhanced?: boolean;
};

const VECTOR_WEIGHT = resolveWeight(process.env.FAQ_VECTOR_WEIGHT, 6);
const LEXICAL_WEIGHT = resolveWeight(process.env.FAQ_LEXICAL_WEIGHT, 4);

export function mergeFaqResults(
  vectorResults: FaqHybridHit[],
  lexicalResults: FaqHybridHit[],
  limit: number,
  options?: MergeOptions,
): FaqHybridHit[] {
  const enhanced = shouldEnhance(options);
  if (!enhanced) {
    const deduped = new Map<number, FaqHybridHit>();

    for (const result of vectorResults) {
      if (!deduped.has(result.item.id)) {
        deduped.set(result.item.id, result);
      }
    }

    for (const lexical of lexicalResults) {
      if (deduped.size >= limit) break;
      if (!deduped.has(lexical.item.id)) {
        deduped.set(lexical.item.id, lexical);
      }
    }

    return Array.from(deduped.values()).slice(0, limit);
  }

  type CombinedEntry = {
    hit: FaqHybridHit;
    vectorRank?: number;
    lexicalRank?: number;
  };

  const merged = new Map<number, CombinedEntry>();

  vectorResults.forEach((hit, index) => {
    merged.set(hit.item.id, {
      hit: { ...hit },
      vectorRank: index,
    });
  });

  lexicalResults.forEach((hit, index) => {
    const existing = merged.get(hit.item.id);
    if (existing) {
      existing.hit = {
        ...existing.hit,
        lexicalScore: hit.lexicalScore ?? existing.hit.lexicalScore,
        snippet: existing.hit.snippet ?? hit.snippet,
      };
      existing.lexicalRank = index;
    } else {
      merged.set(hit.item.id, {
        hit: { ...hit },
        lexicalRank: index,
      });
    }
  });

  const scored = Array.from(merged.values());
  scored.sort((a, b) => computeCombinedScore(b) - computeCombinedScore(a));

  return scored.slice(0, limit).map((entry) => entry.hit);
}

export function mapFaqLexicalResults(faqs: Faq[], query: string, options?: MergeOptions): FaqHybridHit[] {
  const enhanced = shouldEnhance(options);
  const entries = faqs.map((faq, index) => {
    const lexicalScore = enhanced ? scoreFaqLexical(query, faq) : undefined;
    return {
      hit: {
        item: faq,
        source: "lexical" as const,
        snippet: buildFaqSnippet(faq.answer),
        lexicalScore,
      },
      index,
    };
  });

  if (!enhanced) {
    return entries.map((entry) => entry.hit);
  }

  entries.sort((a, b) => {
    const scoreDiff = (b.hit.lexicalScore ?? 0) - (a.hit.lexicalScore ?? 0);
    if (scoreDiff !== 0) {
      return scoreDiff;
    }
    return a.index - b.index;
  });

  return entries.map((entry) => entry.hit);
}

function scoreFaqLexical(query: string, faq: Faq): number | undefined {
  const tokens = extractSearchTokens(query, { maxTokens: 8 });
  if (tokens.length === 0) return undefined;

  const question = normalizeText(faq.question);
  const answer = normalizeText(faq.answer);

  let score = 0;
  let matched = 0;

  for (const token of tokens) {
    if (question.includes(token)) {
      score += 3;
      matched += 1;
    }
    if (answer.includes(token)) {
      score += 1;
      matched += 1;
    }
  }

  if (score === 0) return undefined;
  score += matched * 0.2;
  return score;
}

function shouldEnhance(options?: MergeOptions): boolean {
  if (typeof options?.enhanced === "boolean") {
    return options.enhanced;
  }
  return process.env.HYBRID_SEARCH_ENHANCED === "true";
}

function resolveWeight(value: string | number | undefined, fallback: number): number {
  if (typeof value === "number" && Number.isFinite(value)) {
    return value;
  }
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }
  return fallback;
}

function computeCombinedScore(entry: { hit: FaqHybridHit; vectorRank?: number; lexicalRank?: number }): number {
  const vectorComponent = normalizeVectorScore(entry.hit.score);
  const lexicalComponent = entry.hit.lexicalScore ?? 0;
  const vectorRankBonus = typeof entry.vectorRank === "number" ? 1 / (entry.vectorRank + 1) : 0;
  const lexicalRankBonus = typeof entry.lexicalRank === "number" ? 1 / (entry.lexicalRank + 1) : 0;

  return (vectorComponent * VECTOR_WEIGHT) + (lexicalComponent * LEXICAL_WEIGHT) + vectorRankBonus + lexicalRankBonus;
}

function normalizeVectorScore(distance?: number): number {
  if (typeof distance !== "number" || Number.isNaN(distance)) {
    return 0;
  }

  if (distance <= 0) {
    return 10;
  }

  if (distance < 1) {
    return Math.max(0, 2 - distance);
  }

  return 0;
}

