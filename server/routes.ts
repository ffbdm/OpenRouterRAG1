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

const defaultGatherInstruction = getDefaultInstructionContent(defaultInstructionSlugs.chatGather)
  ?? "Você opera em duas etapas. Nesta etapa 1 é obrigatório coletar dados antes de responder: (1) analise a pergunta e chame pelo menos uma tool; use searchCatalog para qualquer pedido de produtos/cultivo/fabricante/preços e use searchFaqs para políticas, processos ou quando houver dúvida. (2) Se não tiver certeza, chame searchCatalog E searchFaqs; nunca avance sem pelo menos uma tool. (3) Cumprimentos ou mensagens sem intenção clara (ex.: 'oi', 'olá', 'bom dia', 'tudo bem?') não devem acionar tools; responda curto e peça o objetivo antes de buscar. (4) Envie a pergunta completa como query e resuma os resultados em português (nome, categoria, fabricante, preço, tags ou trechos úteis das FAQs). (5) Se uma busca retornar zero itens, escreva explicitamente que não encontrou nada e convide o usuário a fornecer mais detalhes. Nunca invente dados que não vieram das tools e registre apenas fatos observáveis.";
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

const toolUsageReminder = [
  "Regras obrigatórias para usar tools:",
  "- Sempre chame searchCatalog para pedidos de produtos, cultivo, fabricantes ou preços, enviando a pergunta completa na query.",
  "- Chame searchFaqs para políticas/processos ou quando não tiver certeza; se restar dúvida, chame as duas tools.",
  "- Não responda sem pelo menos uma tool. Se nada for encontrado, informe isso claramente.",
  "- Cumprimentos sem intenção clara (ex.: 'oi', 'olá', 'bom dia', 'boa tarde', 'e aí') não devem acionar nenhuma tool; responda breve e peça o que a pessoa quer buscar.",
].join("\n");

const finalResponseReminder = [
  "Agora gere a resposta final ao usuário usando apenas os dados das mensagens system (FAQ/Catálogo).",
  "Não descreva escolhas de ferramenta, não devolva 'call:' ou 'tool_choice' e não repita instruções internas.",
  "Estruture: (1) resumo da busca e quantidade; (2) resposta com nomes de produtos/trechos; (3) próximos passos claros.",
].join("\n");

function resolveLimit(rawLimit?: number, fallback = 5, max = 10): number {
  if (!Number.isFinite(rawLimit) || !rawLimit) return fallback;
  return Math.min(Math.max(1, Math.floor(rawLimit)), max);
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
          role: "system",
          content: toolUsageReminder,
        },
        {
          role: "user",
          content: message,
        },
      ];

      const tools = [
        {
          type: "function" as const,
          function: {
            name: "searchFaqs",
            description: "Busca perguntas e respostas frequentes no banco de dados PostgreSQL. Use para políticas/processos e sempre que houver dúvida antes de responder.",
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
            description: "Consulta híbrida (vetorial + lexical) dos itens ativos do catálogo (nome, descrição, categoria, fabricante, preço e tags). Obrigatório para pedidos sobre produtos, fabricantes, preços ou cultivo.",
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

      const requestBody = {
        model: DEFAULT_CHAT_MODEL,
        messages: messages,
        tools: tools,
        tool_choice: "auto",
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
            message: "⚠️ Nenhuma tool foi chamada; banco NÃO consultado (fluxo de uma chamada) — revise instruções se não era esperado",
          },
        });
      }

      llmCalls = 2;

      console.log("[OPENROUTER] Segunda chamada - gerando resposta final");

      messages.push({ role: "system", content: finalResponseReminder });

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
