function normalizeWhitespace(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

export function parseOptionalPositiveInt(value: string | undefined): number | undefined {
  if (typeof value !== "string") return undefined;
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return Math.floor(parsed);
}

export function chunkTextByChars(
  input: string,
  options?: {
    chunkSizeChars?: number;
    overlapChars?: number;
    maxChunks?: number;
  },
): string[] {
  const normalized = normalizeWhitespace(input);
  if (!normalized) return [];

  const chunkSizeChars = Math.max(100, Math.floor(options?.chunkSizeChars ?? 1800));
  const overlapChars = Math.max(0, Math.floor(options?.overlapChars ?? 200));
  const step = Math.max(1, chunkSizeChars - overlapChars);
  const maxChunks = Number.isFinite(options?.maxChunks) ? Math.max(1, Math.floor(options!.maxChunks!)) : undefined;

  const chunks: string[] = [];
  for (let start = 0; start < normalized.length; start += step) {
    const chunk = normalized.slice(start, start + chunkSizeChars).trim();
    if (chunk) chunks.push(chunk);
    if (maxChunks && chunks.length >= maxChunks) break;
  }

  return chunks;
}
