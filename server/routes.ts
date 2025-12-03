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

type Message = {
  role: "user" | "assistant" | "system";
  content: string;
};

type ToolCall = {
  id: string;
  type: "function";
  function: {
    name: string;
    arguments: string;
  };
};

const DEFAULT_CHAT_MODEL = process.env.OPENROUTER_MODEL
  || process.env.OPENROUTER_FALLBACK_MODEL;

if (!DEFAULT_CHAT_MODEL) {
  throw new Error("Defina OPENROUTER_MODEL ou OPENROUTER_FALLBACK_MODEL antes de iniciar o servidor.");
}

const catalogIntentKeywords = [
  "produto",
  "produtos",
  "catalogo",
  "catálogo",
  "preco",
  "preço",
  "loja",
  "item",
  "itens",
  "fabricante",
  "estoque",
  "disponivel",
  "disponível",
  "precos",
  "preços",
  "comparar",
  "comprar",
];

const genericProductPatterns = [
  /quais\s+produtos/i,
  /que\s+produtos/i,
  /lista\w*\s+produtos/i,
  /mostrar\s+produtos/i,
  /produtos\s+voc[eê]\s+tem/i,
  /produtos\s+dispon[ií]veis/i,
];

const agronomyKeywords = [
  "agronomia",
  "agro",
  "fazenda",
  "campo",
  "fertilizante",
  "fertilizantes",
  "fertilização",
  "foliar",
  "foliares",
  "defensivo",
  "defensivos",
  "soja",
  "milho",
  "sementes",
  "cultivar",
  "nutrição",
  "nutricao",
  "herbicida",
  "fungicida",
  "inseticida",
  "adubo",
  "adjuvante",
];

const defaultGatherInstruction = getDefaultInstructionContent(defaultInstructionSlugs.chatGather)
  ?? "Você opera em duas etapas. Nesta etapa 1, concentre-se em levantar dados antes de responder ao usuário: (1) analise a pergunta e defina quais tools devem ser chamadas; use searchFaqs para processos/políticas e searchCatalog para produtos, fabricantes, preços e ingredientes agronômicos. (2) Sempre que houver termos de catálogo ou agronomia, chame searchCatalog com o texto completo da pergunta (adicione termos-chave apenas se necessário). (3) Resuma os resultados em português destacando nome do item, categoria, fabricante, preço, tags ou trechos úteis das FAQs. (4) Se uma busca retornar zero itens, escreva explicitamente que não encontrou nada e convide o usuário a fornecer mais detalhes. Nunca invente dados que não vieram das tools e registre apenas fatos observáveis.";
const defaultRespondInstruction = getDefaultInstructionContent(defaultInstructionSlugs.chatRespond)
  ?? "Após concluir a etapa de coleta, use apenas os dados enviados como mensagens system para responder ao usuário. Estruture o retorno em português seguindo esta ordem: (1) Resumo da busca — cite quais fontes foram consultadas (FAQs, catálogo ou ambos) e a quantidade de itens relevantes. (2) Resposta principal — entregue a orientação solicitada citando nomes de produtos, fabricantes, preços ou trechos da FAQ que suportem a conclusão. (3) Próximos passos — sugira ações quando não houver dados suficientes (ex.: pedir mais detalhes ou direcionar para o time certo). Se nada foi encontrado, comunique isso claramente e proponha um próximo passo em vez de inventar. Mantenha tom profissional, use frases curtas e evite repetir a pergunta.";

const chatInstructionChain = [
  {
    slug: defaultInstructionSlugs.chatGather,
    fallback: defaultGatherInstruction,
  },
  {
    slug: defaultInstructionSlugs.chatRespond,
    fallback: defaultRespondInstruction,
  },
] as const;

function detectForcedTool(message: string): "searchCatalog" | undefined {
  const normalized = message.toLowerCase();
  const shouldForceCatalog = catalogIntentKeywords.some((keyword) => normalized.includes(keyword));

  return shouldForceCatalog ? "searchCatalog" : undefined;
}

function detectAgronomyIntent(message: string): boolean {
  const normalized = message.toLowerCase();
  const hasCatalogHint = catalogIntentKeywords.some((keyword) => normalized.includes(keyword));
  const hasAgronomyHint = agronomyKeywords.some((keyword) => normalized.includes(keyword));
  const looksLikeSku = /sku[-\s:]?\d{4,}/i.test(normalized) || /#\d{6,}/.test(normalized);

  return (hasCatalogHint || hasAgronomyHint) && !looksLikeSku;
}

function resolveLimit(rawLimit?: number, fallback = 5, max = 10): number {
  if (!Number.isFinite(rawLimit) || !rawLimit) return fallback;
  return Math.min(Math.max(1, Math.floor(rawLimit)), max);
}

function requiresProductClarification(message: string): boolean {
  return genericProductPatterns.some((pattern) => pattern.test(message));
}

type ToolArguments = Record<string, unknown>;

function parseToolArguments<T extends ToolArguments = ToolArguments>(rawArgs?: string): T {
  if (!rawArgs) {
    return {} as T;
  }

  try {
    return JSON.parse(rawArgs) as T;
  } catch (error) {
    console.warn("[TOOL ARGS] Falha ao converter argumentos da tool:", error);
    return {} as T;
  }
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

      if (requiresProductClarification(message)) {
        console.log("[ROUTER] Pergunta genérica sobre produtos - solicitando mais detalhes antes de consultar catálogo");

        return res.json({
          response: "Nosso catálogo é extenso. Pode me dizer categoria, fabricante ou faixa de preço para eu buscar os produtos certos?",
          debug: {
            databaseQueried: false,
            faqsFound: 0,
            catalogItemsFound: 0,
            message: "ℹ️ Solicitadas mais informações antes de consultar o catálogo",
          },
        });
      }

      const chatInstructionMessages: Message[] = [];
      for (const entry of chatInstructionChain) {
        const instruction = await storage.getInstructionBySlug(entry.slug);
        if (!instruction) {
          console.warn(`[INSTRUCTIONS] ${entry.slug} não encontrado. Usando fallback padrão.`);
        }

        const content = instruction?.content?.trim().length ? instruction.content : entry.fallback;
        chatInstructionMessages.push({ role: "system", content });
      }

      let databaseQueried = false;
      let faqsFound = 0;
      let catalogItemsFound = 0;
      let ragSource: "hybrid" | undefined;
      let hybridResult: CatalogHybridSearchResult | undefined;
      let llmCalls = 1;

      const messages: Message[] = [
        ...chatInstructionMessages,
        {
          role: "user",
          content: message,
        },
      ];

      if (detectAgronomyIntent(message)) {
        console.log("[RAG] Intenção agronômica detectada - executando busca híbrida pré-chamada LLM");

        hybridResult = await storage.searchCatalogHybrid(message, resolveLimit(undefined, 5));
        logHybridStats("Pré-busca /api/chat", hybridResult);

        databaseQueried = true;
        ragSource = "hybrid";

        if (hybridResult.results.length > 0) {
          const hybridPayload = buildCatalogPayload(message, hybridResult);
          messages.push({
            role: "system",
            content: hybridPayload,
          });

          catalogItemsFound = hybridResult.results.length;
        }
      }

      const tools = [
        {
          type: "function" as const,
          function: {
            name: "searchFaqs",
            description: "Busca perguntas e respostas frequentes no banco de dados PostgreSQL.",
            parameters: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "Texto de busca para encontrar FAQs relevantes",
                },
                limit: {
                  type: "number",
                  description: "Número máximo de resultados",
                  default: 5,
                },
              },
              required: ["query"],
            },
          },
        },
        {
          type: "function" as const,
          function: {
            name: "searchCatalog",
            description: "Consulta híbrida (vetorial + lexical) dos itens ativos do catálogo (nome, descrição, categoria, fabricante, preço e tags).",
            parameters: {
              type: "object",
              properties: {
                query: {
                  type: "string",
                  description: "Texto de busca para localizar produtos relevantes",
                },
                limit: {
                  type: "number",
                  description: "Número máximo de itens retornados",
                  default: 5,
                },
              },
              required: ["query"],
            },
          },
        },
      ];

      const apiKey = process.env.OPENROUTER_API_KEY;
      if (!apiKey) {
        throw new Error("OPENROUTER_API_KEY não configurada. Verifique as variáveis de ambiente.");
      }

      console.log("[DEBUG] API Key length:", apiKey.length, "First 10 chars:", apiKey.substring(0, 10));
      console.log("[OPENROUTER] Primeira chamada - enviando mensagem com tools disponíveis");

      const forcedTool = detectForcedTool(message);

      if (forcedTool) {
        console.log("[ROUTER] Forçando chamada inicial da tool:", forcedTool);
      }

      const requestBody = {
        model: DEFAULT_CHAT_MODEL,
        messages: messages,
        tools: tools,
        tool_choice: forcedTool
          ? { type: "function", function: { name: forcedTool } }
          : "auto",
        temperature: 0.7,
      };

      console.log("[DEBUG] Request headers:", {
        Authorization: `Bearer ${apiKey.substring(0, 20)}...`,
        "HTTP-Referer": process.env.OPENROUTER_SITE_URL,
        "X-Title": process.env.OPENROUTER_SITE_NAME,
      });

      const firstResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "http://localhost:5000",
          "X-Title": process.env.OPENROUTER_SITE_NAME || "RAG Chat",
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      });

      if (!firstResponse.ok) {
        const errorBody = await firstResponse.text();
        console.log("[ERROR] Response status:", firstResponse.status);
        console.log("[ERROR] Response body:", errorBody);
        throw new Error(`OpenRouter API error: ${firstResponse.status} ${firstResponse.statusText} - ${errorBody}`);
      }

      const firstData = await firstResponse.json();
      const assistantMessage = firstData.choices[0].message;

      console.log("[OPENROUTER] Resposta recebida");
      console.log("  Conteúdo:", assistantMessage.content);
      console.log("  Tool calls:", assistantMessage.tool_calls?.length || 0);

      messages.push({ role: "assistant", content: assistantMessage.content || "" });

      // Processar tool calls se existirem
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        for (const toolCall of assistantMessage.tool_calls) {
          if (toolCall.function.name === "searchFaqs") {
            databaseQueried = true;
            console.log("\n🔍 [FERRAMENTA ACIONADA] searchFaqs foi chamada!");

            const args = parseToolArguments<{ query?: string; limit?: number }>(toolCall.function.arguments);
            const requestedQuery = typeof args.query === "string" ? args.query : "";
            const resolvedQuery = requestedQuery.trim().length > 0 ? requestedQuery : message;
            const resolvedLimit = resolveLimit(args.limit, 5, 15);

            if (!requestedQuery.trim()) {
              console.warn("[FERRAMENTA] searchFaqs veio sem query explícita. Usando mensagem original como fallback.");
            }

            console.log("   Buscando por:", resolvedQuery);

            const results = await storage.searchFaqs(resolvedQuery, resolvedLimit);
            faqsFound = results.length;

            if (results.length > 0) {
              console.log("\n✅ [BANCO DE DADOS] Dados encontrados!");
              console.log("   Total de resultados:", results.length);
              console.log("   Perguntas encontradas:");
              results.forEach((r, idx) => {
                console.log(`     ${idx + 1}. ${r.question}`);
              });
            } else {
              console.log("\n❌ [BANCO DE DADOS] Nenhum resultado encontrado para esta busca");
            }

            const faqPayload = `Resultados da busca para "${resolvedQuery}": ${JSON.stringify(results)}`;
            messages.push({
              role: "system",
              content: faqPayload,
            });

            logToolPayload({
              toolName: "searchFaqs",
              args: {
                requestedArgs: args,
                resolvedQuery,
                limit: resolvedLimit,
              },
              resultCount: results.length,
              aiPayload: faqPayload,
            });
          } else if (toolCall.function.name === "searchCatalog") {
            databaseQueried = true;
            ragSource = "hybrid";
            console.log("\n🔍 [FERRAMENTA ACIONADA] searchCatalog (híbrido) foi chamada!");

            const args = parseToolArguments<{ query?: string; limit?: number }>(toolCall.function.arguments);
            const requestedQuery = typeof args.query === "string" ? args.query : "";
            const resolvedQuery = requestedQuery.trim().length > 0 ? requestedQuery : message;
            const resolvedLimit = resolveLimit(args.limit, 5, 15);

            if (!requestedQuery.trim()) {
              console.warn("[FERRAMENTA] searchCatalog veio sem query explícita. Usando mensagem original como fallback.");
            }

            console.log("   Buscando produtos por:", resolvedQuery);

            const hybridSearch = await storage.searchCatalogHybrid(resolvedQuery, resolvedLimit);
            catalogItemsFound = Math.max(catalogItemsFound, hybridSearch.results.length);
            hybridResult = hybridSearch;

            logHybridStats("Tool searchCatalog", hybridSearch);

            const catalogPayload = buildCatalogPayload(resolvedQuery, hybridSearch);

            messages.push({ role: "system", content: catalogPayload });

            logToolPayload({
              toolName: "searchCatalog",
              args: {
                requestedArgs: args,
                resolvedQuery,
                limit: resolvedLimit,
                source: "hybrid",
                timings: hybridSearch.timings,
              },
              resultCount: hybridSearch.results.length,
              aiPayload: catalogPayload,
            });
          }
        }
      } else {
        if (databaseQueried) {
          console.log("\nℹ️  [RAG] Nenhuma tool extra chamada; usando apenas o contexto pré-busca.");
        } else {
          console.log("\n⚠️  [AI] A IA decidiu NÃO consultar o banco de dados para esta pergunta");
        }
      }

      if (!databaseQueried) {
        console.log("[RAG] Pulando segunda chamada - IA respondeu sem consultar banco");

        const trimmedFirstContent = (assistantMessage.content || "").trim();
        const fallbackAnswer = "Não encontrei informações adicionais no momento, mas posso procurar novamente se você quiser fornecer mais detalhes.";
        const singleHopResponse = trimmedFirstContent.length > 0 ? assistantMessage.content : fallbackAnswer;

        return res.json({
          response: singleHopResponse,
          debug: {
            databaseQueried,
            faqsFound,
            catalogItemsFound,
            ragSource: "none",
            hybrid: undefined,
            llmCalls,
            message: "⚠️ Banco NÃO foi consultado para esta pergunta (fluxo de uma chamada)",
          },
        });
      }

      llmCalls = 2;

      console.log("[OPENROUTER] Segunda chamada - gerando resposta final");

      const finalResponse = await fetch("https://openrouter.ai/api/v1/chat/completions", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${apiKey}`,
          "HTTP-Referer": process.env.OPENROUTER_SITE_URL || "http://localhost:5000",
          "X-Title": process.env.OPENROUTER_SITE_NAME || "RAG Chat",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: DEFAULT_CHAT_MODEL,
          messages: messages,
          temperature: 0.7,
        }),
      });

      if (!finalResponse.ok) {
        const errorBody = await finalResponse.text();
        console.log("[ERROR] Final Response status:", finalResponse.status);
        console.log("[ERROR] Final Response body:", errorBody);
        throw new Error(`OpenRouter API error: ${finalResponse.status} - ${errorBody}`);
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
          databaseQueried,
          faqsFound,
          catalogItemsFound,
          ragSource: databaseQueried ? (ragSource ?? "lexical") : "none",
          hybrid: hybridResult
            ? {
                vectorCount: hybridResult.vectorCount,
                lexicalCount: hybridResult.lexicalCount,
                embeddingUsed: hybridResult.embeddingUsed,
                fallbackReason: hybridResult.fallbackReason,
                timings: hybridResult.timings,
              }
            : undefined,
          llmCalls,
          message: databaseQueried
            ? `✅ Dados do banco consultados (FAQs: ${faqsFound}, Catálogo: ${catalogItemsFound}${ragSource === "hybrid" ? ", híbrido" : ""})`
            : "⚠️ Banco NÃO foi consultado para esta pergunta",
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
