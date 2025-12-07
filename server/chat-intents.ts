export type ChatIntent = "FAQ" | "CATALOG" | "MIST" | "OTHER";

function normalizeRawIntent(raw: string): string {
  return raw
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .trim()
    .toUpperCase();
}

export function normalizeIntent(raw: unknown): ChatIntent {
  if (typeof raw !== "string") return "OTHER";

  const cleaned = normalizeRawIntent(raw);
  if (cleaned.startsWith("FAQ")) return "FAQ";
  if (cleaned.startsWith("CATALOG")) return "CATALOG";
  if (cleaned.startsWith("MIST")) return "MIST";

  return "OTHER";
}

export function planSearches(intent: ChatIntent): {
  runFaq: boolean;
  runCatalog: boolean;
  usedTools: ("searchFaqs" | "searchCatalog")[];
  llmCalls: number;
} {
  const runFaq = intent === "FAQ" || intent === "MIST";
  const runCatalog = intent === "CATALOG" || intent === "MIST";
  const usedTools: ("searchFaqs" | "searchCatalog")[] = [];

  if (runFaq) usedTools.push("searchFaqs");
  if (runCatalog) usedTools.push("searchCatalog");

  return {
    runFaq,
    runCatalog,
    usedTools,
    llmCalls: usedTools.length,
  };
}
