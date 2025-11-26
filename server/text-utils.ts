const STOPWORDS = new Set([
  "a",
  "as",
  "o",
  "os",
  "um",
  "uma",
  "uns",
  "umas",
  "de",
  "da",
  "das",
  "do",
  "dos",
  "no",
  "nos",
  "na",
  "nas",
  "ao",
  "aos",
  "à",
  "às",
  "e",
  "ou",
  "que",
  "qual",
  "quais",
  "pra",
  "para",
  "com",
  "por",
  "sobre",
  "se",
  "ser",
  "em",
]);

const DEFAULT_MIN_LENGTH = 3;
const DEFAULT_MAX_TOKENS = 5;

export function normalizeText(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function extractSearchTokens(
  text: string,
  options?: {
    minLength?: number;
    maxTokens?: number;
  },
): string[] {
  const normalized = normalizeText(text);
  const minLength = options?.minLength ?? DEFAULT_MIN_LENGTH;
  const maxTokens = options?.maxTokens ?? DEFAULT_MAX_TOKENS;

  if (!normalized) {
    return [];
  }

  const tokens = normalized
    .split(" ")
    .filter((token) => token.length >= minLength && !STOPWORDS.has(token));

  return tokens.slice(0, maxTokens);
}
