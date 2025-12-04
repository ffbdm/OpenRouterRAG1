import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { generateObject, NoObjectGeneratedError } from "ai";
import { jsonSchema } from "@ai-sdk/provider-utils";
import { z } from "zod";

import { catalogItemStatusValues, type CatalogItemStatus } from "@shared/schema";
import { logToolPayload } from "./tool-logger";

const DEFAULT_MODEL = process.env.CATALOG_AI_MODEL || "openai/gpt-4o-mini";
const FALLBACK_MODEL = "openai/gpt-4o-mini";
const DEFAULT_MAX_PRICE = Number.isFinite(Number(process.env.CATALOG_AI_MAX_PRICE))
  ? Number(process.env.CATALOG_AI_MAX_PRICE)
  : 100000;

const suggestionSchema = z.object({
  description: z.string().trim().min(8).max(600).optional(),
  category: z.string().trim().min(2).max(120).optional(),
  price: z.number().nonnegative().max(DEFAULT_MAX_PRICE).optional(),
  tags: z.array(z.string().trim()).min(2).max(8).optional(),
  status: z.enum(catalogItemStatusValues).optional(),
});

export type CatalogAiSuggestion = z.infer<typeof suggestionSchema>;

export type CatalogAiInput = {
  name: string;
  manufacturer: string;
  description?: string;
  category?: string;
  price?: number | null;
  tags?: string[];
  status?: CatalogItemStatus;
};

type CatalogSuggestionField = keyof CatalogAiSuggestion;

export type CatalogAiResult = {
  suggestions: CatalogAiSuggestion;
  model: string;
  usage: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
};

const EMPTY_LABEL = "(vazio)";

function normalizeTags(tags?: string[]): string[] | undefined {
  if (!tags || tags.length === 0) return undefined;

  const normalized = tags
    .map((tag) => tag.trim().toLowerCase())
    .filter(Boolean);

  if (normalized.length === 0) return undefined;

  return Array.from(new Set(normalized)).slice(0, 8);
}

function clampPrice(value: number | undefined): number | undefined {
  if (typeof value !== "number" || !Number.isFinite(value)) return undefined;
  if (value < 0) return undefined;

  const limited = Math.min(value, DEFAULT_MAX_PRICE);
  return Number(limited.toFixed(2));
}

function sanitizeSuggestion(raw: CatalogAiSuggestion): CatalogAiSuggestion {
  const safe: CatalogAiSuggestion = {};

  if (raw.description?.trim()) {
    safe.description = raw.description.trim().slice(0, 600);
  }

  if (raw.category?.trim()) {
    safe.category = raw.category.trim().slice(0, 120);
  }

  const price = clampPrice(raw.price);
  if (typeof price === "number") {
    safe.price = price;
  }

  const tags = normalizeTags(raw.tags);
  if (tags?.length) {
    safe.tags = tags;
  }

  if (raw.status && catalogItemStatusValues.includes(raw.status)) {
    safe.status = raw.status;
  }

  return safe;
}

function describeValue(label: string, value: string | number | string[] | undefined | null): string {
  if (value == null) return `${label}: ${EMPTY_LABEL}`;
  if (Array.isArray(value)) {
    return `${label}: ${value.length ? value.join(", ") : EMPTY_LABEL}`;
  }
  if (typeof value === "number") {
    return `${label}: ${value}`;
  }
  const trimmed = value.trim();
  return `${label}: ${trimmed || EMPTY_LABEL}`;
}

function buildPrompt(input: CatalogAiInput, missingFields: CatalogSuggestionField[]): string {
  const lines = [
    describeValue("Nome", input.name),
    describeValue("Fabricante", input.manufacturer),
    describeValue("Descrição", input.description),
    describeValue("Categoria", input.category),
    describeValue("Preço", input.price),
    describeValue("Tags", input.tags && input.tags.length ? input.tags.join(", ") : undefined),
  ];

  return [
    "Você é um assistente que completa cadastros de itens de catálogo agrícola em português do Brasil.",
    "Preencha apenas os campos faltantes listados, mantendo coerência com o nome e o fabricante informados.",
    "Regras:",
    "- Não altere nome ou fabricante e não invente SKU.",
    "- Descrição: até 2 frases curtas com benefícios e uso prático.",
    "- Categoria: termo curto (ex.: 'Fertilizante foliar', 'Inoculante').",
    "- Preço: número decimal em reais, sem 'R$', dentro de um valor plausível para o mercado brasileiro.",
    "- Tags: 3 a 6 palavras-chave minúsculas, sem símbolos.",
    `Campos faltantes: ${missingFields.join(", ")}`,
    "",
    "Dados já preenchidos:",
    lines.join("\n"),
    "",
    "Responda apenas com o objeto JSON pedido pelo schema.",
  ].join("\n");
}

function buildSuggestionJsonSchema(missingFields: CatalogSuggestionField[]) {
  const properties: Record<string, unknown> = {};

  if (missingFields.includes("description")) {
    properties.description = {
      type: "string",
      minLength: 8,
      maxLength: 600,
      description: "Descrição curta em português do Brasil (1 a 2 frases).",
    };
  }

  if (missingFields.includes("category")) {
    properties.category = {
      type: "string",
      minLength: 2,
      maxLength: 120,
      description: "Categoria concisa, como 'Fertilizante foliar' ou 'Inoculante'.",
    };
  }

  if (missingFields.includes("price")) {
    properties.price = {
      type: "number",
      minimum: 0,
      maximum: DEFAULT_MAX_PRICE,
      description: "Preço estimado em reais, apenas o número (ex.: 129.9).",
    };
  }

  if (missingFields.includes("tags")) {
    properties.tags = {
      type: "array",
      minItems: 2,
      maxItems: 8,
      items: {
        type: "string",
        minLength: 2,
        maxLength: 60,
      },
      description: "Lista de palavras-chave minúsculas, separadas por vírgula.",
    };
  }

  const required = Object.keys(properties);

  return jsonSchema<CatalogAiSuggestion>(
    () => ({
      $schema: "http://json-schema.org/draft-07/schema#",
      type: "object",
      description: "Objeto JSON contendo apenas os campos faltantes do catálogo.",
      properties,
      required,
      additionalProperties: false,
    }),
    {
      validate: async (value) => {
        const parsed = await suggestionSchema.safeParseAsync(value);
        return parsed.success
          ? { success: true, value: parsed.data }
          : { success: false, error: parsed.error };
      },
    },
  );
}

export async function generateCatalogSuggestions(
  input: CatalogAiInput,
  missingFields: CatalogSuggestionField[],
): Promise<CatalogAiResult> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    throw new Error("OPENROUTER_API_KEY não configurada para sugestões do catálogo.");
  }

  if (missingFields.length === 0) {
    return {
      suggestions: {},
      model: DEFAULT_MODEL,
      usage: {},
    };
  }

  const openrouterHeaders: Record<string, string> = {
    "X-Title": process.env.OPENROUTER_SITE_NAME || "OpenRouterRAG",
  };

  if (process.env.OPENROUTER_SITE_URL) {
    openrouterHeaders["HTTP-Referer"] = process.env.OPENROUTER_SITE_URL;
  }

  const openrouter = createOpenRouter({
    apiKey,
    baseURL: process.env.OPENROUTER_BASE_URL,
    headers: openrouterHeaders,
    compatibility: "compatible",
  });

  const prompt = buildPrompt(input, missingFields);

  const structuredSchema = buildSuggestionJsonSchema(missingFields);

  const modelsToTry = Array.from(new Set([DEFAULT_MODEL, FALLBACK_MODEL]));

  let object: CatalogAiSuggestion | undefined;
  let usage: { inputTokens?: number; outputTokens?: number; totalTokens?: number } | undefined;
  let usedModel = DEFAULT_MODEL;
  let lastError: unknown;

  for (const modelId of modelsToTry) {
    try {
      const result = await generateObject({
        model: openrouter(modelId),
        schema: structuredSchema,
        schemaName: "catalog_assist_response",
        schemaDescription: "Sugestões automáticas para campos faltantes do catálogo.",
        system: "Gere apenas campos que estão vazios no formulário, com dados curtos e factuais.",
        prompt,
        temperature: 0.4,
        maxOutputTokens: 800,
      });

      object = result.object;
      usage = result.usage;
      usedModel = modelId;
      break;
    } catch (error) {
      lastError = error;

      if (NoObjectGeneratedError.isInstance?.(error) || error instanceof NoObjectGeneratedError) {
        console.warn("[CATALOG_AI] NoObjectGeneratedError, tentando fallback", {
          model: modelId,
          finishReason: (error as NoObjectGeneratedError).finishReason,
          response: (error as NoObjectGeneratedError).response,
        });
        continue;
      }

      console.warn("[CATALOG_AI] Falha ao gerar sugestões com modelo", { model: modelId, error });
    }
  }

  if (!object) {
    throw lastError || new Error("Não foi possível gerar sugestões de IA.");
  }

  const suggestions = sanitizeSuggestion(object);
  const suggestedFields = Object.entries(suggestions)
    .filter(([, value]) => value !== undefined && value !== null)
    .map(([key]) => key)
    .join(", ") || "nenhum";

  logToolPayload({
    toolName: "catalog-ai-helper",
    args: {
      model: usedModel,
      missingFields,
    },
    resultCount: Object.keys(suggestions).length,
    aiPayload: prompt,
  });

  console.log("[CATALOG_AI] Sugestões geradas", {
    model: usedModel,
    missingFields,
    suggestedFields,
    usage,
  });

  return {
    suggestions,
    model: DEFAULT_MODEL,
    usage: {
      promptTokens: usage?.inputTokens,
      completionTokens: usage?.outputTokens,
      totalTokens: usage?.totalTokens,
    },
  };
}
