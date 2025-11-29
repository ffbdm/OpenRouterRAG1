import type { CatalogFile, CatalogItem } from "@shared/schema";

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

export function buildSnippet(content: string, limit = 220): string {
  const normalized = normalizeWhitespace(content);
  if (normalized.length <= limit) return normalized;
  return `${normalized.slice(0, limit - 1)}…`;
}
