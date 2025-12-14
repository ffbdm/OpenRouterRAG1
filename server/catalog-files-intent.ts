import { normalizeText } from "./text-utils";

const CATALOG_FILE_KEYWORDS = [
  "bula",
  "fispq",
  "ficha",
  "ficha tecnica",
  "ficha técnica",
  "msds",
  "sds",
  "composicao",
  "composição",
  "ingrediente",
  "ingredientes",
  "principio ativo",
  "princípio ativo",
  "dose",
  "dosagem",
  "ppm",
  "tabela",
  "pdf",
  "anexo",
  "arquivo",
  "documento",
  "laudo",
  "especificacao",
  "especificação",
];

const NORMALIZED_KEYWORDS = CATALOG_FILE_KEYWORDS.map((keyword) => normalizeText(keyword));

export function inferUseCatalogFiles(userMessage: string): boolean {
  const normalized = normalizeText(userMessage);
  if (!normalized) return false;
  return NORMALIZED_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

