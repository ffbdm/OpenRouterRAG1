import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import { type CatalogHybridHit, type CatalogHybridSearchResult } from "./catalog-hybrid";
import { type FaqHybridSearchResult } from "./faq-hybrid";
import { getBufferedLogs, subscribeToLogs, type LogEntry } from "./log-stream";
import { logToolPayload } from "./tool-logger";
import { registerCatalogRoutes } from "./catalog-routes";
import { registerInstructionRoutes } from "./instruction-routes";
import { defaultInstructionSlugs, ensureDefaultInstructions, getDefaultInstructionContent } from "./instruction-defaults";
import { normalizeIntent, planSearches, type ChatIntent } from "./chat-intents";
import { registerWhatsAppRoutes } from "./whatsapp-routes";
import { parseOptionalPositiveInt } from "./text-chunking";
import { inferUseCatalogFiles } from "./catalog-files-intent";
import { buildClassificationMessages, type Message } from "./chat-prompts";

type ChatHistoryMessage = {
  role: "user" | "assistant";
  content: string;
};

const DEFAULT_CHAT_MODEL = process.env.OPENROUTER_MODEL
  || process.env.OPENROUTER_FALLBACK_MODEL;

if (!DEFAULT_CHAT_MODEL) {
  throw new Error("Defina OPENROUTER_MODEL ou OPENROUTER_FALLBACK_MODEL antes de iniciar o servidor.");
}

const defaultClassificationInstruction = getDefaultInstructionContent(defaultInstructionSlugs.chatGather);
const defaultRespondInstruction = getDefaultInstructionContent(defaultInstructionSlugs.chatRespond);

function resolveLimit(rawLimit?: number, fallback = 5, max = 10): number {
  if (!Number.isFinite(rawLimit) || !rawLimit) return fallback;
  return Math.min(Math.max(1, Math.floor(rawLimit)), max);
}

const chatHistoryLimit = resolveLimit(Number(process.env.CHAT_HISTORY_CONTEXT_LIMIT), 6, 20);
// Resumo: por padrão dispara a partir de 1 mensagem no histórico (ou seja, já no 2º envio do usuário, se o client enviar history).
// Pode ser ajustado via CHAT_HISTORY_SUMMARY_TRIGGER.
const historySummaryTrigger = resolveLimit(Number(process.env.CHAT_HISTORY_SUMMARY_TRIGGER), 1, 10);
const historySummaryCharLimit = 800;
const historySummaryMessageLimit = chatHistoryLimit;

const systemInstructionLogLimit = 50;

function truncateForLog(content: string, limit = systemInstructionLogLimit): string {
  if (content.length <= limit) return content;
  return `${content.slice(0, limit)}...`;
}

function formatCatalogHit(hit: CatalogHybridHit, index?: number): string {
  const tagList = hit.item.tags.join(", ") || "sem tags";
  const price = Number.isFinite(hit.item.price) ? `R$${hit.item.price.toFixed(2)}` : "preço indisponível";
  const vectorScore = typeof hit.score === "number" ? `vec:${hit.score.toFixed(4)}` : undefined;
  const lexicalScore = typeof hit.lexicalScore === "number" ? `lex:${hit.lexicalScore.toFixed(2)}` : undefined;
  const score = vectorScore || lexicalScore ? [vectorScore, lexicalScore].filter(Boolean).join(" ") : "lexical";
  const hasLexicalContext = typeof hit.lexicalScore === "number";
  const sourceLabel = hit.source === "lexical"
    ? "lexical"
    : hasLexicalContext
      ? `vetorial+lexical:${hit.source}`
      : `vetorial:${hit.source}`;
  const snippet = hit.snippet || hit.item.description;
  const prefix = typeof index === "number" ? `${index + 1}. ` : "";

  return `${prefix}${hit.item.name} | ${hit.item.category} | ${hit.item.manufacturer} | ${price} | Tags: ${tagList} | Fonte: ${sourceLabel} | Score: ${score} | Snippet: ${snippet}`;
}

function buildCatalogPayload(query: string, result: CatalogHybridSearchResult): string {
  if (result.results.length === 0) {
    return `Nenhum item do catálogo encontrado (busca híbrida) para "${query}".`;
  }

  const summary = result.results
    .map((hit, index) => formatCatalogHit(hit, index))
    .join(" || ");

  return `Busca híbrida (vetorial + lexical) para "${query}": ${summary}`;
}

function buildCatalogFilesPayload(params: {
  query: string;
  hybrid: CatalogHybridSearchResult;
  resultsByItemId: Record<number, { originalName: string; snippet: string }[]>;
}): string {
  const entries = params.hybrid.results
    .map((hit) => {
      const chunks = params.resultsByItemId[hit.item.id] ?? [];
      if (chunks.length === 0) return undefined;
      const chunkSummary = chunks
        .map((chunk, index) => `${index + 1}. ${chunk.originalName}: ${chunk.snippet}`)
        .join(" || ");
      return `${hit.item.name}: ${chunkSummary}`;
    })
    .filter(Boolean) as string[];

  if (entries.length === 0) {
    return `Trechos relevantes de anexos (enriquecimento; não altera ranking) para "${params.query}": nenhum trecho encontrado.`;
  }

  const joined = entries.join(" || ");
  return `Trechos relevantes de anexos (enriquecimento; não altera ranking) para "${params.query}": ${joined}`;
}

function logHybridStats(label: string, result: CatalogHybridSearchResult) {
  const timing = result.timings;
  console.log(`[RAG] ${label} :: total=${result.results.length} vetorial=${result.vectorCount} lexical=${result.lexicalCount} embeddingUsed=${result.embeddingUsed}`);
  console.log(`[RAG] Tempos (ms) → vector=${timing.vectorMs} lexical=${timing.lexicalMs} merge=${timing.mergeMs} total=${timing.totalMs}`);
  if (result.fallbackReason) {
    console.log(`[RAG] Fallback: ${result.fallbackReason}`);
  }

  if (result.results.length > 0) {
    console.log(`[RAG] Detalhes de ranking:`);
    result.results.forEach((hit, index) => {
      const vectorScore = typeof hit.score === "number" ? hit.score.toFixed(4) : "n/a";
      const lexicalScore = typeof hit.lexicalScore === "number" ? hit.lexicalScore.toFixed(2) : "n/a";
      const pairTag = hit.lexicalSignals?.hasCultureTreatmentPair ? " pair" : "";
      const sourceLabel = hit.source === "lexical" ? "lexical" : `vetorial:${hit.source}`;
      console.log(`  #${index + 1} ${hit.item.name} | fonte=${sourceLabel} | vec=${vectorScore} | lex=${lexicalScore}${pairTag}`);
    });
  }
}

function logFaqHybridStats(label: string, result: FaqHybridSearchResult) {
  const timing = result.timings;
  console.log(`[RAG] ${label} :: total=${result.results.length} vetorial=${result.vectorCount} lexical=${result.lexicalCount} embeddingUsed=${result.embeddingUsed}`);
  console.log(`[RAG] Tempos (ms) → vector=${timing.vectorMs} lexical=${timing.lexicalMs} merge=${timing.mergeMs} total=${timing.totalMs}`);
  if (result.fallbackReason) {
    console.log(`[RAG] Fallback: ${result.fallbackReason}`);
  }

  if (result.results.length > 0) {
    console.log(`[RAG] Detalhes de ranking (FAQ):`);
    result.results.forEach((hit, index) => {
      const vectorScore = typeof hit.score === "number" ? hit.score.toFixed(4) : "n/a";
      const lexicalScore = typeof hit.lexicalScore === "number" ? hit.lexicalScore.toFixed(2) : "n/a";
      console.log(`  #${index + 1} ${hit.item.question} | fonte=${hit.source} | vec=${vectorScore} | lex=${lexicalScore}`);
    });
  }
}

function buildHistorySection(history: ChatHistoryMessage[] | undefined, limit: number): string {
  if (!history || history.length === 0) {
    return "Histórico do chat: não enviado pelo cliente ou vazio.";
  }

  const normalized = history
    .filter((item): item is ChatHistoryMessage => !!item && typeof item.content === "string" && !!item.content.trim())
    .map((item) => {
      const trimmed = item.content.trim();
      const truncated = trimmed.length > 1200 ? `${trimmed.slice(0, 1200)}...` : trimmed;
      return { ...item, content: truncated };
    })
    .slice(-limit);

  if (normalized.length === 0) {
    return "Histórico do chat: não enviado pelo cliente ou vazio.";
  }

  const label = normalized.length === 1 ? "mensagem" : "mensagens";
  const lines = normalized.map((item, index) => `${index + 1}. ${item.role === "assistant" ? "Assistente" : "Usuário"}: ${item.content}`);

  return [
    `Histórico recente do chat (${normalized.length} ${label}, limite configurado=${limit}, ordem cronológica):`,
    ...lines,
  ].join("\n");
}

const QUERY_CONTEXT_MESSAGE_LIMIT = 2;
const QUERY_CONTEXT_CHAR_LIMIT = 400;

function buildQueryContextFromHistory(history: ChatHistoryMessage[] | undefined): string | undefined {
  if (!history || history.length === 0) return undefined;

  const recent = history
    .filter((item): item is ChatHistoryMessage => !!item && typeof item.content === "string" && !!item.content.trim())
    .slice(-QUERY_CONTEXT_MESSAGE_LIMIT)
    .map((item) => {
      const trimmed = item.content.trim();
      const truncated = trimmed.length > QUERY_CONTEXT_CHAR_LIMIT ? `${trimmed.slice(0, QUERY_CONTEXT_CHAR_LIMIT)}...` : trimmed;
      const speaker = item.role === "assistant" ? "assistente" : "usuário";
      return `${speaker}: ${truncated}`;
    });

  if (recent.length === 0) return undefined;

  return `Contexto recente do chat (para buscas): ${recent.join(" | ")}`;
}

async function summarizeHistory(
  history: ChatHistoryMessage[] | undefined,
  userMessage: string,
  apiKey: string,
  model: string,
): Promise<{ summary: string; catalogQuery?: string } | undefined> {
  if (!history || history.length < historySummaryTrigger) return undefined;

  const normalizedHistory = history
    .filter((item): item is ChatHistoryMessage => !!item && typeof item.content === "string" && !!item.content.trim())
    .slice(-historySummaryMessageLimit)
    .map((item: ChatHistoryMessage) => {
      const trimmed = item.content.trim();
      const truncated = trimmed.length > historySummaryCharLimit
        ? `${trimmed.slice(0, historySummaryCharLimit)}...`
        : trimmed;

      return { ...item, content: truncated };
    });

  if (normalizedHistory.length < historySummaryTrigger) return undefined;

  const summaryResponseFormat = {
    type: "json_schema" as const,
    json_schema: {
      name: "history_summary",
      schema: {
        type: "object",
        properties: {
          summary: { type: "string" },
          catalogQuery: { type: "string" },
        },
        required: ["summary"],
        additionalProperties: false,
      },
      strict: true,
    },
  };

  const summaryMessages: Message[] = [
    {
      role: "system",
      content: [
        "Você cria um resumo conciso da conversa recente (usuário+assistente) e, quando fizer sentido, sugere uma query curta de palavras-chave para busca em catálogo.",
        "Regras:",
        "- Não invente dados.",
        "- Seja objetivo e em português.",
        "- A query de catálogo deve conter apenas palavras-chave (sem frases longas), separadas por espaço, com no máximo 12 termos.",
        "- Se não houver contexto útil para catálogo, omita catalogQuery.",
      ].join("\n"),
    },
    ...normalizedHistory.map((item) => ({ role: item.role, content: item.content })),
    {
      role: "user",
      content: [
        `Mensagem atual do usuário: ${userMessage}`,
        "",
        "Retorne APENAS um JSON válido com o formato:",
        '{ "summary": "2-3 bullet points em português", "catalogQuery": "opcional" }',
        "",
        "O campo summary deve ter no máximo 200 palavras.",
      ].join("\n"),
    },
  ];

  try {
    const callSummary = async (useResponseFormat: boolean) => {
      const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "http://localhost:5000",
          "X-Title": process.env.OPENROUTER_SITE_NAME || "RAG Chat",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model,
          messages: summaryMessages,
          temperature: 0,
          max_tokens: 256,
          ...(useResponseFormat ? { response_format: summaryResponseFormat } : {}),
        }),
      });

      return response;
    };

    let response = await callSummary(true);
    if (!response.ok) {
      const errorBody = await response.text();
      console.warn(`[SUMMARY] Falha ao gerar resumo (status=${response.status}):`, errorBody);

      if (response.status === 400) {
        console.warn("[SUMMARY] Tentando novamente sem response_format (compatibilidade de modelo).");
        response = await callSummary(false);
      }
    }

    if (!response.ok) {
      const errorBody = await response.text();
      console.warn(`[SUMMARY] Falha ao gerar resumo (fallback status=${response.status}):`, errorBody);
      return undefined;
    }

    const data = await response.json();
    const message = data?.choices?.[0]?.message ?? {};
    const rawContent = typeof message.content === "string" ? message.content : "";
    if (!rawContent.trim()) return undefined;

    let summary = rawContent.trim();
    let catalogQuery: string | undefined;

    const extractJsonCandidate = (content: string): string | undefined => {
      const trimmed = content.trim();
      if (!trimmed) return undefined;

      if (trimmed.startsWith("```")) {
        const withoutFence = trimmed
          .replace(/^```[a-zA-Z0-9]*\n?/, "")
          .replace(/```$/, "")
          .trim();
        if (withoutFence) return withoutFence;
      }

      const start = trimmed.indexOf("{");
      const end = trimmed.lastIndexOf("}");
      if (start >= 0 && end > start) {
        return trimmed.slice(start, end + 1);
      }

      return undefined;
    };

    const jsonCandidate = extractJsonCandidate(rawContent);
    if (jsonCandidate?.startsWith("{")) {
      try {
        const parsed = JSON.parse(jsonCandidate) as { summary?: unknown; catalogQuery?: unknown };
        if (parsed && typeof parsed.summary === "string" && parsed.summary.trim()) {
          summary = parsed.summary.trim();
          if (typeof parsed.catalogQuery === "string" && parsed.catalogQuery.trim()) {
            catalogQuery = parsed.catalogQuery.trim();
          }
        }
      } catch (error) {
        console.warn("[SUMMARY] Falha ao fazer parse do JSON de resumo:", error);
      }
    }

    return { summary, catalogQuery };
  } catch (error) {
    console.warn("[SUMMARY] Erro ao gerar resumo do histórico:", error);
    return undefined;
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  await ensureDefaultInstructions();
  registerCatalogRoutes(app);
  registerInstructionRoutes(app);
  registerWhatsAppRoutes(app);

  app.get("/api/logs/stream", (req, res) => {
    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache");
    res.setHeader("Connection", "keep-alive");
    (res as typeof res & { flushHeaders?: () => void }).flushHeaders?.();

    const sendEvent = (entry: LogEntry) => {
      res.write(`data: ${JSON.stringify(entry)}\n\n`);
    };

    getBufferedLogs().forEach(sendEvent);
    const unsubscribe = subscribeToLogs(sendEvent);
    const heartbeat = setInterval(() => {
      res.write(":keep-alive\n\n");
    }, 30000);

    req.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  });

  app.post("/api/rag/search", async (req, res) => {
    const schema = z.object({
      query: z.string().trim().min(1),
      limit: z.number().int().positive().max(20).optional(),
    });

    const parsed = schema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({ error: "Payload inválido", details: parsed.error.flatten() });
    }

    const { query, limit } = parsed.data;
    const resolvedLimit = resolveLimit(limit, 5, 20);

    try {
      const result = await storage.searchCatalogHybrid(query, resolvedLimit);
      logHybridStats("/api/rag/search", result);

      return res.json({
        query,
        results: result.results,
        stats: {
          vectorCount: result.vectorCount,
          lexicalCount: result.lexicalCount,
          embeddingUsed: result.embeddingUsed,
          fallbackReason: result.fallbackReason,
          timings: result.timings,
        },
      });
    } catch (error) {
      console.error("[RAG] Erro na busca híbrida:", error);
      return res.status(500).json({ error: "Erro ao executar busca híbrida" });
    }
  });

  app.post("/api/chat", async (req, res) => {
    try {
      const chatSchema = z.object({
        message: z.string().trim().min(1),
        history: z.array(z.object({
          role: z.enum(["user", "assistant"]),
          content: z.string().trim().min(1),
        })).max(50).optional(),
      });

      const parsedChat = chatSchema.safeParse(req.body);
      if (!parsedChat.success) {
        return res.status(400).json({ error: "Payload inválido", details: parsedChat.error.flatten() });
      }

      const { message, history } = parsedChat.data;
      const userMessage = message.trim();

      console.log("\n========================================");
      console.log("[REQUEST] Mensagem do usuário:", userMessage);
      console.log("========================================\n");

      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) {
        throw new Error("OPENROUTER_API_KEY não configurada. Verifique as variáveis de ambiente.");
      }

      const classificationModelsToTry = Array.from(new Set([
        process.env.OPENROUTER_MODEL_CLASSIFY,
        process.env.OPENROUTER_MODEL_CLASSIFY_FALLBACK,
        DEFAULT_CHAT_MODEL,
      ].filter(Boolean)));
      const answerModel = process.env.OPENROUTER_MODEL_ANSWER ?? DEFAULT_CHAT_MODEL;
      if (!answerModel) {
        throw new Error("Defina OPENROUTER_MODEL_ANSWER ou OPENROUTER_MODEL/OPENROUTER_FALLBACK_MODEL.");
      }
      if (!process.env.OPENROUTER_MODEL_CLASSIFY) {
        console.warn("[WARN] OPENROUTER_MODEL_CLASSIFY não definida; usando fallback configurado ou modelo padrão para classificação.");
      }
      if (!process.env.OPENROUTER_MODEL_ANSWER) {
        console.warn("[WARN] OPENROUTER_MODEL_ANSWER não definida; usando modelo padrão para a resposta.");
      }

      const [classificationInstruction, respondInstruction] = await Promise.all([
        storage.getInstructionBySlug(defaultInstructionSlugs.chatGather),
        storage.getInstructionBySlug(defaultInstructionSlugs.chatRespond),
      ]);

      const classificationContent = classificationInstruction?.content?.trim();
      const respondContent = respondInstruction?.content?.trim();

      if (!classificationContent) {
        throw new Error("Instrução de classificação ausente ou vazia no banco. Verifique system_instructions.buscar-dados.");
      }

      if (!respondContent) {
        throw new Error("Instrução de resposta ausente ou vazia no banco. Verifique system_instructions.responder-usuario.");
      }

      console.log("[DEBUG] API Key length:", apiKey.length, "First 10 chars:", apiKey.substring(0, 10));
      console.log("[MODELS] classify candidates:", classificationModelsToTry.join(" -> "), "| answer:", answerModel);

      const historySignals = await summarizeHistory(history, userMessage, apiKey, answerModel);
      const historySummary = historySignals?.summary;
      const catalogKeywordQuery = historySignals?.catalogQuery;

      const classificationMessages = buildClassificationMessages({
        classificationContent,
        historySummary,
        userMessage,
      });

      console.log("[OPENROUTER] Chamada de classificação iniciada");

      const classificationResponseFormat = {
        type: "json_schema" as const,
        json_schema: {
          name: "chat_intent",
          schema: {
            type: "object",
            properties: {
              intent: { type: "string", enum: ["FAQ", "CATALOG", "MIST", "OTHER"] },
              useCatalogFiles: { type: "boolean" },
            },
            required: ["intent", "useCatalogFiles"],
            additionalProperties: false,
          },
          strict: true,
        },
      };

      const classificationMessagesForLog = classificationMessages.map((msg) =>
        msg.role === "system" && msg.content === classificationContent
          ? { ...msg, content: truncateForLog(msg.content) }
          : msg,
      );

      console.log(
        "[LOG] Contexto enviado para a primeira LLM (classificação):",
        JSON.stringify(classificationMessagesForLog, null, 2),
      );

      let classifyData: unknown;
      let classifyResponseMeta: { status: number; requestId: string | null } | undefined;
      let classificationModelUsed: string | undefined;
      let rawIntent = "";
      let useCatalogFiles = false;

      for (const [index, model] of classificationModelsToTry.entries()) {
        const hasNextModel = index < classificationModelsToTry.length - 1;
        console.log(`[OPENROUTER] Chamada de classificação iniciada (model=${model})`);

        try {
          const classifyResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
            method: "POST",
            headers: {
              "Authorization": `Bearer ${apiKey}`,
              "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "http://localhost:5000",
              "X-Title": process.env.OPENROUTER_SITE_NAME || "RAG Chat",
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              model,
              messages: classificationMessages,
              temperature: 0,
              // Espaço para modelos que gastam tokens em reasoning antes do conteúdo JSON.
              max_tokens: 256,
              response_format: classificationResponseFormat,
            }),
          });

          if (!classifyResponse.ok) {
            const errorBody = await classifyResponse.text();
            console.log(`[ERROR] Classification status (${model}):`, classifyResponse.status);
            console.log(`[ERROR] Classification body (${model}):`, errorBody);

            if (hasNextModel) {
              console.warn(`[CLASSIFY] Tentando fallback de classificação: ${classificationModelsToTry[index + 1]}`);
              continue;
            }

            throw new Error(`OpenRouter API error (classify): ${classifyResponse.status} ${classifyResponse.statusText} - ${errorBody}`);
          }

          const classifyJson = await classifyResponse.json();
          const classifyMessage = classifyJson.choices?.[0]?.message ?? {};
          const rawContent = typeof classifyMessage.content === "string" ? classifyMessage.content : "";

          // Tenta extrair JSON quando response_format é respeitado; senão, usa o conteúdo direto.
          let candidateIntent = rawContent;
          let candidateUseCatalogFiles: boolean | undefined;
          if (rawContent.trim().startsWith("{")) {
            try {
              const parsed = JSON.parse(rawContent);
              if (parsed && typeof parsed.intent === "string") {
                candidateIntent = parsed.intent;
              }
              if (parsed && typeof parsed.useCatalogFiles === "boolean") {
                candidateUseCatalogFiles = parsed.useCatalogFiles;
              }
            } catch (error) {
              console.warn("[CLASSIFY] Falha ao fazer parse do JSON de intenção:", error);
            }
          }

          classifyData = classifyJson;
          classifyResponseMeta = {
            status: classifyResponse.status,
            requestId: classifyResponse.headers.get("x-request-id"),
          };
          rawIntent = candidateIntent;
          useCatalogFiles = typeof candidateUseCatalogFiles === "boolean"
            ? candidateUseCatalogFiles
            : inferUseCatalogFiles(userMessage);
          classificationModelUsed = model;

          if (!candidateIntent.trim() && hasNextModel) {
            console.warn(`[CLASSIFY] Conteúdo vazio retornado pelo modelo de classificação (${model}); tentando fallback ${classificationModelsToTry[index + 1]}.`);
            classificationModelUsed = undefined;
            continue;
          }

          break;
        } catch (error) {
          console.error(`[CLASSIFY] Erro ao chamar modelo ${model}:`, error);
          if (hasNextModel) {
            console.warn(`[CLASSIFY] Tentando fallback de classificação: ${classificationModelsToTry[index + 1]}`);
            continue;
          }
          throw error;
        }
      }

      if (!classificationModelUsed) {
        throw new Error("Não foi possível classificar a intenção com os modelos configurados.");
      }

      if (!rawIntent.trim()) {
        console.warn(`[CLASSIFY] Conteúdo vazio retornado pelo modelo de classificação (${classificationModelUsed}).`);
        console.warn("[CLASSIFY] Resposta completa:", JSON.stringify({
          id: (classifyData as Record<string, unknown> | undefined)?.id,
          model: (classifyData as Record<string, unknown> | undefined)?.model,
          choices: (classifyData as Record<string, unknown> | undefined)?.choices,
          usage: (classifyData as Record<string, unknown> | undefined)?.usage,
          status: classifyResponseMeta?.status,
          requestId: classifyResponseMeta?.requestId,
        }, null, 2));
      }
      const intent: ChatIntent = normalizeIntent(rawIntent);

      console.log(`[CLASSIFY] Intenção: ${intent} (raw="${rawIntent || "vazio"}" | model=${classificationModelUsed}) useCatalogFiles=${useCatalogFiles}`);
      console.log("[MODELS] classify usado:", classificationModelUsed, "| answer:", answerModel);

      console.log(`[CHAT] Histórico recebido: ${(history?.length ?? 0)} mensagens (limite configurado=${chatHistoryLimit}).`);

      const historySection = buildHistorySection(history, chatHistoryLimit);
      const queryContext = buildQueryContextFromHistory(history);
      if (queryContext) {
        console.log(`[CHAT] queryContext aplicado nas buscas: ${queryContext}`);
      }

      const searchPlan = planSearches(intent);
      console.log(`[ROUTING] Tools planejadas: ${searchPlan.usedTools.join(", ") || "nenhuma"} | llmCalls=${searchPlan.llmCalls}`);

      let databaseQueried = false;
      let faqsFound = 0;
      let catalogItemsFound = 0;
      let ragSource: "hybrid" | undefined;
      let hybridResult: CatalogHybridSearchResult | undefined;
      let catalogFilesUsed = false;
      let catalogFilesChunks = 0;
      let catalogFilesTimingMs = 0;

      const contextSections: string[] = [
        historySection,
      ];

      if (historySummary) {
        console.log(`[SUMMARY] Resumo automático do histórico habilitado (≥${historySummaryTrigger} mensagens).`);
        contextSections.push(`Resumo automático da conversa: ${historySummary}`);
      }

	      if (searchPlan.runFaq) {
	        databaseQueried = true;
	        const resolvedLimit = resolveLimit(undefined, 5, 15);
	        console.log("\n🔍 [BUSCA] Executando searchFaqsHybrid");

	        const hybridFaqSearch = await storage.searchFaqsHybrid(userMessage, resolvedLimit, { queryContext });
	        const results = hybridFaqSearch.results.map((hit) => hit.item);
	        faqsFound = results.length;

	        logFaqHybridStats("RAG faqs", hybridFaqSearch);

	        if (results.length > 0) {
	          console.log("✅ [FAQs] Encontradas", results.length);
	          results.forEach((r, idx) => console.log(`   ${idx + 1}. ${r.question}`));
	        } else {
	          console.log("❌ [FAQs] Nenhuma FAQ relevante encontrada");
	        }

	        const faqContext = results.length > 0
	          ? results.map((faq, idx) => `${idx + 1}. Q: ${faq.question} | A: ${faq.answer}`).join(" || ")
	          : "Nenhuma FAQ relevante encontrada.";

	        contextSections.push(`FAQs relevantes (${results.length}): ${faqContext}`);

	        logToolPayload({
	          toolName: "searchFaqs",
	          args: {
	            query: userMessage,
	            limit: resolvedLimit,
	            intent,
	            queryContext,
	            source: "hybrid",
	            timings: hybridFaqSearch.timings,
	          },
	          resultCount: hybridFaqSearch.results.length,
	          aiPayload: faqContext,
	        });
	      } else {
	        contextSections.push("FAQs relevantes: nenhuma consulta executada para esta pergunta.");
	      }

	      if (searchPlan.runCatalog) {
	        databaseQueried = true;
	        ragSource = "hybrid";
	        const resolvedLimit = resolveLimit(undefined, 5, 15);
	        console.log("\n🔍 [BUSCA] Executando searchCatalogHybrid");

	        const keywordQueryEnabled = process.env.CATALOG_QUERY_KEYWORDS_ENABLED === "true";
	        const resolvedCatalogKeywordQuery = catalogKeywordQuery?.trim();
	        const catalogSearchQuery = keywordQueryEnabled && resolvedCatalogKeywordQuery
	          ? resolvedCatalogKeywordQuery
	          : userMessage;

	        const catalogSearchContext = keywordQueryEnabled && !resolvedCatalogKeywordQuery && historySummary
	          ? historySummary
	          : queryContext;

	        console.log(`[RAG] Query catálogo (searchCatalogHybrid) => "${truncateForLog(catalogSearchQuery, 240)}"`);
	        if (catalogSearchContext?.trim()) {
	          const contextPreview = catalogSearchContext.replace(/\s+/g, " ").trim();
	          console.log(`[RAG] Query catálogo :: queryContext => "${truncateForLog(contextPreview, 240)}"`);
	        }

	        if (keywordQueryEnabled && resolvedCatalogKeywordQuery) {
	          console.log(`[RAG] catalogQuery gerada a partir do resumo: "${truncateForLog(resolvedCatalogKeywordQuery, 240)}"`);
	        } else if (keywordQueryEnabled && historySummary) {
	          console.log(`[RAG] Sem catalogQuery; usando resumo do histórico como queryContext (summarizeHistory).`);
	        }

	        const hybridSearch = await storage.searchCatalogHybrid(catalogSearchQuery, resolvedLimit, { queryContext: catalogSearchContext });
	        catalogItemsFound = hybridSearch.results.length;
	        hybridResult = hybridSearch;

        logHybridStats("RAG catalog", hybridSearch);

        const catalogPayload = buildCatalogPayload(userMessage, hybridSearch);
        contextSections.push(catalogPayload);

        if (useCatalogFiles && hybridSearch.results.length > 0) {
          const topN = parseOptionalPositiveInt(process.env.CATALOG_FILES_ENRICH_TOP_N) ?? 5;
          const catalogItemIds = hybridSearch.results
            .slice(0, Math.max(1, Math.min(topN, hybridSearch.results.length)))
            .map((hit) => hit.item.id);

          const filesVectorQuery = catalogKeywordQuery?.trim() || userMessage;
          console.log(`[RAG] Enriquecimento por anexos habilitado: itens=${catalogItemIds.length} (topN=${topN})`);
          console.log(`[RAG] Query vetorial (anexos): ${filesVectorQuery === userMessage ? "userMessage" : "catalogQuery"}`);
          const filesResult = await storage.searchCatalogFilesVector({ query: filesVectorQuery, catalogItemIds });
          catalogFilesUsed = true;
          catalogFilesChunks = filesResult.vectorCount;
          catalogFilesTimingMs = filesResult.timingMs;

          const filesPayload = buildCatalogFilesPayload({
            query: userMessage,
            hybrid: hybridSearch,
            resultsByItemId: filesResult.resultsByItemId,
          });

          const maxChars = parseOptionalPositiveInt(process.env.CATALOG_FILES_CONTEXT_MAX_CHARS) ?? 2500;
          contextSections.push(filesPayload.length > maxChars ? `${filesPayload.slice(0, Math.max(0, maxChars - 1))}…` : filesPayload);

          logToolPayload({
            toolName: "searchCatalogFiles",
            args: {
              query: userMessage,
              searchQuery: filesVectorQuery,
              itemIds: catalogItemIds,
              intent,
              useCatalogFiles,
              timingMs: filesResult.timingMs,
              fallbackReason: filesResult.fallbackReason,
            },
            resultCount: filesResult.vectorCount,
            aiPayload: filesPayload,
          });
        } else {
          contextSections.push("Trechos relevantes de anexos: não consultados para esta pergunta.");
        }

        logToolPayload({
          toolName: "searchCatalog",
          args: {
            query: userMessage,
            searchQuery: catalogSearchQuery,
            limit: resolvedLimit,
            intent,
            source: "hybrid",
            timings: hybridSearch.timings,
          },
          resultCount: hybridSearch.results.length,
          aiPayload: catalogPayload,
        });
      } else {
        contextSections.push("Produtos do catálogo: nenhuma consulta executada para esta pergunta.");
      }

      console.log("[OPENROUTER] Segunda chamada - resposta final sem tools");

      const userAnswerPayload = [
        "Contexto consolidado (não mencione esta seção ao responder):",
        contextSections.join("\n\n"),
        `Pergunta do usuário: ${userMessage}`,
      ].join("\n\n");

      const answerMessages: Message[] = [
        { role: "system", content: respondContent },
        { role: "user", content: userAnswerPayload },
      ];

      console.log("[DEBUG] Mensagens enviadas para segunda chamada:");
      answerMessages.forEach((msg, idx) => {
        const loggedContent = msg.role === "system" && msg.content === respondContent
          ? truncateForLog(msg.content)
          : msg.content;
        console.log(`  ${idx + 1}. Role: ${msg.role}`);
        console.log(`     Content: ${loggedContent}`);
      });

      const finalResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "http://localhost:5000",
          "X-Title": process.env.OPENROUTER_SITE_NAME || "RAG Chat",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: answerModel,
          messages: answerMessages,
          temperature: 0.7,
        }),
      });

      if (!finalResponse.ok) {
        const errorBody = await finalResponse.text();
        console.log("[ERROR] Final Response status:", finalResponse.status);
        console.log("[ERROR] Final Response body:", errorBody);
        throw new Error(`OpenRouter API error (answer): ${finalResponse.status} - ${errorBody}`);
      }

      const finalData = await finalResponse.json();
      const finalText = finalData.choices[0].message.content;

      console.log("[OPENROUTER] Resposta final gerada");
      console.log("  Resposta:", finalText);
      console.log("\n========================================");
      console.log("[RESPONSE] Enviando resposta ao cliente");
      console.log("========================================\n");

      res.json({
        response: finalText,
        debug: {
          intent,
          classification: {
            raw: rawIntent,
            model: classificationModelUsed,
          },
          models: {
            classify: classificationModelUsed,
            answer: answerModel,
          },
          databaseQueried,
          usedTools: searchPlan.usedTools,
          llmCalls: searchPlan.llmCalls,
          faqsFound,
          catalogItemsFound,
          ragSource: databaseQueried ? (ragSource ?? "none") : "none",
          hybrid: hybridResult
            ? {
                vectorCount: hybridResult.vectorCount,
                lexicalCount: hybridResult.lexicalCount,
                embeddingUsed: hybridResult.embeddingUsed,
                fallbackReason: hybridResult.fallbackReason,
                timings: hybridResult.timings,
              }
            : undefined,
          useCatalogFiles,
          catalogFiles: catalogFilesUsed
            ? {
                used: true,
                chunks: catalogFilesChunks,
                timingMs: catalogFilesTimingMs,
              }
            : {
                used: false,
              },
        }
      });
    } catch (error) {
      console.error("\n[ERROR] Erro ao processar chat:", error);
      res.status(500).json({
        error: "Erro ao processar mensagem",
        details: error instanceof Error ? error.message : "Erro desconhecido",
      });
    }
  });

  const httpServer = createServer(app);

  return httpServer;
}
