import OpenAI from "openai";

import { catalogEmbeddingDimensions } from "@shared/schema";

const DEFAULT_MODEL = process.env.EMBEDDING_MODEL || "text-embedding-3-small";
const DEFAULT_TIMEOUT_MS = Number.isFinite(Number(process.env.EMBEDDING_TIMEOUT_MS))
  ? Number(process.env.EMBEDDING_TIMEOUT_MS)
  : 2000;
const CACHE_LIMIT = Number.isFinite(Number(process.env.EMBEDDING_CACHE_SIZE))
  ? Number(process.env.EMBEDDING_CACHE_SIZE)
  : 32;
const CHAR_LIMIT = Number.isFinite(Number(process.env.EMBEDDING_CHAR_LIMIT))
  ? Number(process.env.EMBEDDING_CHAR_LIMIT)
  : 4000;
const ENV_DIMENSIONS = Number(process.env.EMBEDDING_DIMENSIONS);
const EMBEDDING_DIMENSIONS = Number.isFinite(ENV_DIMENSIONS)
  ? ENV_DIMENSIONS
  : catalogEmbeddingDimensions;

type EmbeddingCache = Map<string, number[]>;

const embeddingCache: EmbeddingCache = new Map();
let openaiClient: OpenAI | null = null;
let missingKeyLogged = false;

function normalizeCacheKey(input: string): string {
  return input.trim().toLowerCase();
}

function normalizeContent(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

function addToCache(key: string, embedding: number[]): void {
  if (CACHE_LIMIT <= 0) return;
  if (embeddingCache.has(key)) {
    embeddingCache.delete(key);
  } else if (embeddingCache.size >= CACHE_LIMIT) {
    const oldestKey = embeddingCache.keys().next().value;
    if (oldestKey) {
      embeddingCache.delete(oldestKey);
    }
  }

  embeddingCache.set(key, embedding);
}

function getCachedEmbedding(key: string): number[] | undefined {
  const cached = embeddingCache.get(key);
  if (!cached) return undefined;

  embeddingCache.delete(key);
  embeddingCache.set(key, cached);
  return cached;
}

function getClient(): OpenAI | null {
  if (openaiClient) return openaiClient;

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    if (!missingKeyLogged) {
      console.warn("[EMBEDDINGS] OPENROUTER_API_KEY não configurada; usando fallback lexical.");
      missingKeyLogged = true;
    }
    return null;
  }

  openaiClient = new OpenAI({
    apiKey,
    baseURL: process.env.OPENROUTER_BASE_URL || "https://openrouter.ai/api/v1",
    defaultHeaders: {
      "HTTP-Referer": process.env.OPENROUTER_SITE_URL,
      "X-Title": process.env.OPENROUTER_SITE_NAME || "OpenRouterRAG",
    },
    timeout: DEFAULT_TIMEOUT_MS,
  });

  return openaiClient;
}

export function embeddingsEnabled(): boolean {
  return Boolean(process.env.OPENROUTER_API_KEY);
}

export function getEmbeddingSettings(): {
  model: string;
  dimensions: number;
  timeoutMs: number;
  cacheSize: number;
  charLimit: number;
} {
  return {
    model: DEFAULT_MODEL,
    dimensions: EMBEDDING_DIMENSIONS,
    timeoutMs: DEFAULT_TIMEOUT_MS,
    cacheSize: CACHE_LIMIT,
    charLimit: CHAR_LIMIT,
  };
}

export async function generateCatalogEmbedding(input: string): Promise<number[] | null> {
  const client = getClient();
  const normalizedContent = normalizeContent(input);

  if (!client) return null;
  if (!normalizedContent) return null;

  const cacheKey = normalizeCacheKey(normalizedContent);
  const cached = getCachedEmbedding(cacheKey);
  if (cached) {
    return cached;
  }

  const limitedContent = normalizedContent.length > CHAR_LIMIT
    ? normalizedContent.slice(0, CHAR_LIMIT)
    : normalizedContent;

  try {
    const response = await client.embeddings.create({
      model: DEFAULT_MODEL,
      input: limitedContent,
      dimensions: EMBEDDING_DIMENSIONS,
    });

    const embedding = response.data[0]?.embedding;
    if (!embedding || embedding.length === 0) {
      throw new Error("Resposta de embedding vazia");
    }

    addToCache(cacheKey, embedding);
    return embedding;
  } catch (error) {
    console.warn("[EMBEDDINGS] Falha ao gerar embedding:", error);
    return null;
  }
}
