import type { CatalogItem } from "@shared/schema";
import { extractSearchTokens, normalizeText } from "./text-utils";

const CULTURE_SYNONYMS: Record<string, readonly string[]> = {
  uva: ["uva", "uvas", "parreira", "videira", "vinhedo", "vitis"],
  soja: ["soja", "glycine", "leguminosa"],
  milho: ["milho", "safrinha", "zea", "zea mays"],
  cafe: ["cafe", "cafeeiro", "cafezal", "arabica", "robusta"],
  citros: ["citros", "laranja", "limao", "pomar"],
  trigo: ["trigo", "cereal"],
  algodao: ["algodao", "gossypium"],
  cana: ["cana", "cana de acucar", "sorgo"]
} as const;

const TREATMENT_SYNONYMS: Record<string, readonly string[]> = {
  pesticida: ["pesticida", "pesticidas", "defensivo", "defensivos", "agrotoxico", "controle de pragas"],
  fungicida: ["fungicida", "fungicidas", "antifungo", "controle de fungos"],
  inseticida: ["inseticida", "inseticidas", "controle de insetos", "lagarta", "pulgiao", "pragas"],
  herbicida: ["herbicida", "herbicidas", "pos emergente", "posemergente", "mato", "erva daninha"],
  acaricida: ["acaricida", "acaros"],
  biologico: ["biologico", "biologicos", "bioinsumo"],
} as const;

const GENERIC_SYNONYMS: Record<string, readonly string[]> = {
  fertilizante: ["fertilizante", "adubo", "nutriente", "foliar"],
  regulador: ["regulador", "hormonio"],
  inoculante: ["inoculante", "inoculantes"],
};

type FieldName = "name" | "description" | "category" | "manufacturer" | "tags";

type SynonymLookup = Map<string, string>;

const cultureLookup = buildLookup(CULTURE_SYNONYMS);
const treatmentLookup = buildLookup(TREATMENT_SYNONYMS);
const genericLookup = buildLookup(GENERIC_SYNONYMS);

function buildLookup(dictionary: Record<string, readonly string[]>): SynonymLookup {
  const lookup = new Map<string, string>();
  for (const [canonical, synonyms] of Object.entries(dictionary)) {
    const normalizedCanonical = normalizeText(canonical);
    lookup.set(normalizedCanonical, normalizedCanonical);
    for (const synonym of synonyms) {
      const normalizedSynonym = normalizeText(synonym);
      lookup.set(normalizedSynonym, normalizedCanonical);
    }
  }
  return lookup;
}

type TokenCategory = "culture" | "treatment" | "generic";

function resolveCategory(token: string): TokenCategory {
  if (cultureLookup.has(token)) return "culture";
  if (treatmentLookup.has(token)) return "treatment";
  return "generic";
}

function expandToken(token: string, category: TokenCategory): string[] {
  switch (category) {
    case "culture":
      return expandFromDictionary(token, CULTURE_SYNONYMS, cultureLookup);
    case "treatment":
      return expandFromDictionary(token, TREATMENT_SYNONYMS, treatmentLookup);
    default:
      return expandFromDictionary(token, GENERIC_SYNONYMS, genericLookup, token);
  }
}

function expandFromDictionary(
  token: string,
  dictionary: Record<string, readonly string[]>,
  lookup: SynonymLookup,
  fallback?: string,
): string[] {
  const canonical = lookup.get(token) ?? normalizeText(token);
  const synonyms = dictionary[canonical];
  const baseList = synonyms ? [canonical, ...synonyms.map(normalizeText)] : [canonical, fallback ?? canonical];
  return Array.from(new Set(baseList.filter(Boolean)));
}

export type CatalogLexicalSignals = {
  tokens: string[];
  matchedTokens: string[];
  matchedFields: Record<FieldName, string[]>;
  cultureMatches: string[];
  treatmentMatches: string[];
  hasCultureTreatmentPair: boolean;
};

export type CatalogLexicalScore = {
  score: number;
  signals: CatalogLexicalSignals;
};

type NormalizedFields = {
  name: string;
  description: string;
  category: string;
  manufacturer: string;
  tags: string[];
};

function normalizeFields(item: CatalogItem): NormalizedFields {
  return {
    name: normalizeText(item.name),
    description: normalizeText(item.description),
    category: normalizeText(item.category),
    manufacturer: normalizeText(item.manufacturer),
    tags: (item.tags ?? []).map((tag) => normalizeText(tag)),
  };
}

const FIELD_WEIGHTS: Record<FieldName, number> = {
  name: 3.5,
  description: 2.5,
  category: 2,
  manufacturer: 1.5,
  tags: 4,
};

const CULTURE_MATCH_BONUS = 2;
const TREATMENT_MATCH_BONUS = 2;
const CULTURE_TREATMENT_PAIR_BONUS = 5;
const TOKEN_MATCH_BONUS = 0.5;
const TAG_CULTURE_EXTRA = 1;

export function scoreCatalogItemLexical(query: string, item: CatalogItem): CatalogLexicalScore | undefined {
  const tokens = extractSearchTokens(query, { maxTokens: 8 });
  if (tokens.length === 0) {
    return undefined;
  }

  const normalizedFields = normalizeFields(item);
  const matchedTokens = new Set<string>();
  const cultureMatches = new Set<string>();
  const treatmentMatches = new Set<string>();
  const matchedFields: Record<FieldName, string[]> = {
    name: [],
    description: [],
    category: [],
    manufacturer: [],
    tags: [],
  };

  let score = 0;

  for (const token of tokens) {
    const category = resolveCategory(token);
    const expansions = expandToken(token, category);

    const appliedFields: FieldName[] = [];

    if (containsAny(normalizedFields.name, expansions)) {
      score += FIELD_WEIGHTS.name;
      appliedFields.push("name");
    }
    if (containsAny(normalizedFields.description, expansions)) {
      score += FIELD_WEIGHTS.description;
      appliedFields.push("description");
    }
    if (containsAny(normalizedFields.category, expansions)) {
      score += FIELD_WEIGHTS.category;
      appliedFields.push("category");
    }
    if (containsAny(normalizedFields.manufacturer, expansions)) {
      score += FIELD_WEIGHTS.manufacturer;
      appliedFields.push("manufacturer");
    }

    const tagMatched = normalizedFields.tags.some((tag) => containsAny(tag, expansions));
    if (tagMatched) {
      score += FIELD_WEIGHTS.tags;
      appliedFields.push("tags");
    }

    if (appliedFields.length > 0) {
      matchedTokens.add(token);
      score += TOKEN_MATCH_BONUS;
      for (const field of appliedFields) {
        matchedFields[field].push(token);
      }

      if (category === "culture") {
        cultureMatches.add(cultureLookup.get(token) ?? token);
        if (tagMatched) {
          score += TAG_CULTURE_EXTRA;
        }
      }

      if (category === "treatment") {
        treatmentMatches.add(treatmentLookup.get(token) ?? token);
      }
    }
  }

  if (cultureMatches.size > 0) {
    score += CULTURE_MATCH_BONUS;
  }

  if (treatmentMatches.size > 0) {
    score += TREATMENT_MATCH_BONUS;
  }

  const hasCultureTreatmentPair = cultureMatches.size > 0 && treatmentMatches.size > 0;
  if (hasCultureTreatmentPair) {
    score += CULTURE_TREATMENT_PAIR_BONUS;
  }

  if (score === 0) {
    return undefined;
  }

  return {
    score,
    signals: {
      tokens,
      matchedTokens: Array.from(matchedTokens),
      matchedFields,
      cultureMatches: Array.from(cultureMatches),
      treatmentMatches: Array.from(treatmentMatches),
      hasCultureTreatmentPair,
    },
  };
}

function containsAny(text: string, expansions: string[]): boolean {
  return expansions.some((term) => term && text.includes(term));
}
