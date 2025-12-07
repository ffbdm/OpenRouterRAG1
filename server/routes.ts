import type { Express } from "express";
import { createServer, type Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import { type CatalogHybridHit, type CatalogHybridSearchResult } from "./catalog-hybrid";
import { getBufferedLogs, subscribeToLogs, type LogEntry } from "./log-stream";
import { logToolPayload } from "./tool-logger";
import { registerCatalogRoutes } from "./catalog-routes";
import { registerInstructionRoutes } from "./instruction-routes";
import { defaultInstructionSlugs, ensureDefaultInstructions, getDefaultInstructionContent } from "./instruction-defaults";
import { normalizeIntent, planSearches, type ChatIntent } from "./chat-intents";

type Message = {
  role: "user" | "assistant" | "system";
  content: string;
};

const DEFAULT_CHAT_MODEL = process.env.OPENROUTER_MODEL
  || process.env.OPENROUTER_FALLBACK_MODEL;

if (!DEFAULT_CHAT_MODEL) {
  throw new Error("Defina OPENROUTER_MODEL ou OPENROUTER_FALLBACK_MODEL antes de iniciar o servidor.");
}

const defaultClassificationInstruction = getDefaultInstructionContent(defaultInstructionSlugs.chatGather)
  ?? "Classifique cada mensagem do usuário em apenas uma palavra maiúscula conforme o destino da busca: FAQ (políticas/processos, dúvidas sobre atendimento), CATALOG (produtos, cultivo, fabricante, preço), MIST (quando a pergunta mistura FAQ + catálogo ou há dúvida entre eles) ou OTHER (saudações e assuntos fora do escopo). Não explique, não chame ferramentas e não devolva texto além da palavra escolhida.";
const defaultRespondInstruction = getDefaultInstructionContent(defaultInstructionSlugs.chatRespond)
  ?? "Use somente o contexto fornecido (pergunta do usuário, FAQs e itens de catálogo selecionados pelo backend) para responder. Não mencione ferramentas, classificação ou passos internos. Estruture em português: (1) Resumo das fontes consultadas e quantidades (FAQs, catálogo, ambos ou nenhum); (2) Resposta principal com nomes de produtos ou trechos relevantes; (3) Próximos passos claros. Se nada foi encontrado, explique isso e peça detalhes adicionais em vez de inventar.";

const finalResponseReminder = [
  "Use apenas o contexto fornecido abaixo para responder ao usuário.",
  "Não mencione classificação, ferramentas, IDs de sections ou mensagens de sistema.",
  "Estruture em português: (1) resumo das fontes consultadas e contagens; (2) resposta principal com evidências; (3) próximos passos objetivos. Seja conciso e direto.",
].join("\n");

function resolveLimit(rawLimit?: number, fallback = 5, max = 10): number {
  if (!Number.isFinite(rawLimit) || !rawLimit) return fallback;
  return Math.min(Math.max(1, Math.floor(rawLimit)), max);
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

export async function registerRoutes(app: Express): Promise<Server> {
  await ensureDefaultInstructions();
  registerCatalogRoutes(app);
  registerInstructionRoutes(app);

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
      const { message } = req.body;

      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Mensagem inválida" });
      }

      console.log("\n========================================");
      console.log("[REQUEST] Mensagem do usuário:", message);
      console.log("========================================\n");

      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) {
        throw new Error("OPENROUTER_API_KEY não configurada. Verifique as variáveis de ambiente.");
      }

      const classificationModel = process.env.OPENROUTER_MODEL_CLASSIFY || DEFAULT_CHAT_MODEL;
      const answerModel = process.env.OPENROUTER_MODEL_ANSWER || DEFAULT_CHAT_MODEL;
      if (!process.env.OPENROUTER_MODEL_CLASSIFY) {
        console.warn("[WARN] OPENROUTER_MODEL_CLASSIFY não definida; usando modelo padrão para classificação.");
      }
      if (!process.env.OPENROUTER_MODEL_ANSWER) {
        console.warn("[WARN] OPENROUTER_MODEL_ANSWER não definida; usando modelo padrão para a resposta.");
      }

      const respondInstruction = await storage.getInstructionBySlug(defaultInstructionSlugs.chatRespond);
      const respondContent = respondInstruction?.content?.trim().length
        ? respondInstruction.content
        : defaultRespondInstruction;

      console.log("[DEBUG] API Key length:", apiKey.length, "First 10 chars:", apiKey.substring(0, 10));
      console.log("[MODELS] classify:", classificationModel, "| answer:", answerModel);

      const classificationMessages: Message[] = [
        { role: "system", content: defaultClassificationInstruction },
        { role: "system", content: "Retorne somente uma palavra maiúscula: FAQ, CATALOG, MIST ou OTHER." },
        { role: "user", content: message },
      ];

      console.log("[OPENROUTER] Chamada de classificação iniciada");

      const classifyResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "http://localhost:5000",
          "X-Title": process.env.OPENROUTER_SITE_NAME || "RAG Chat",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: classificationModel,
          messages: classificationMessages,
          temperature: 0,
          // Alguns provedores exigem mínimo de 16 tokens; manter baixo sem quebrar.
          max_tokens: 16,
        }),
      });

      if (!classifyResponse.ok) {
        const errorBody = await classifyResponse.text();
        console.log("[ERROR] Classification status:", classifyResponse.status);
        console.log("[ERROR] Classification body:", errorBody);
        throw new Error(`OpenRouter API error (classify): ${classifyResponse.status} ${classifyResponse.statusText} - ${errorBody}`);
      }

      const classifyData = await classifyResponse.json();
      const classifyMessage = classifyData.choices?.[0]?.message ?? {};
      const rawIntent = typeof classifyMessage.content === "string" ? classifyMessage.content : "";
      const intent: ChatIntent = normalizeIntent(rawIntent);

      console.log(`[CLASSIFY] Intenção: ${intent} (raw="${rawIntent || "vazio"}")`);

      const searchPlan = planSearches(intent);
      console.log(`[ROUTING] Tools planejadas: ${searchPlan.usedTools.join(", ") || "nenhuma"} | llmCalls=${searchPlan.llmCalls}`);

      let databaseQueried = false;
      let faqsFound = 0;
      let catalogItemsFound = 0;
      let ragSource: "hybrid" | undefined;
      let hybridResult: CatalogHybridSearchResult | undefined;

      const contextSections: string[] = [
        `Mensagem do usuário: """${message}"""`,
      ];

      if (searchPlan.runFaq) {
        databaseQueried = true;
        const resolvedLimit = resolveLimit(undefined, 5, 15);
        console.log("\n🔍 [BUSCA] Executando searchFaqs");

        const results = await storage.searchFaqs(message, resolvedLimit);
        faqsFound = results.length;

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
          args: { query: message, limit: resolvedLimit, intent },
          resultCount: results.length,
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

        const hybridSearch = await storage.searchCatalogHybrid(message, resolvedLimit);
        catalogItemsFound = hybridSearch.results.length;
        hybridResult = hybridSearch;

        logHybridStats("RAG catalog", hybridSearch);

        const catalogPayload = buildCatalogPayload(message, hybridSearch);
        contextSections.push(catalogPayload);

        logToolPayload({
          toolName: "searchCatalog",
          args: {
            query: message,
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

      const answerMessages: Message[] = [
        { role: "system", content: respondContent },
        { role: "system", content: finalResponseReminder },
        { role: "system", content: "Contexto consolidado (não mencione esta seção ao responder):\n" + contextSections.join("\n\n") },
        { role: "user", content: message },
      ];

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
            model: classificationModel,
          },
          models: {
            classify: classificationModel,
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
