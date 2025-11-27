import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { getBufferedLogs, subscribeToLogs, type LogEntry } from "./log-stream";

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

export async function registerRoutes(app: Express): Promise<Server> {
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

  app.post("/api/chat", async (req, res) => {
    try {
      const { message } = req.body;

      if (!message || typeof message !== "string") {
        return res.status(400).json({ error: "Mensagem inválida" });
      }

      console.log("\n========================================");
      console.log("[REQUEST] Mensagem do usuário:", message);
      console.log("========================================\n");

      const messages: Message[] = [
        {
          role: "system",
          content: "Você é um assistente de FAQ e catálogo inteligente. Consulte searchFaqs para perguntas frequentes e searchCatalog para dúvidas sobre produtos, itens, fabricantes ou preços. Baseie suas respostas nos resultados encontrados e informe se nada for localizado. Responda sempre em português de forma clara e objetiva.",
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
            description: "Consulta itens ativos do catálogo (nome, descrição, categoria, fabricante, preço e tags).",
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
        model: "x-ai/grok-4.1-fast:free",
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
      let databaseQueried = false;
      let faqsFound = 0;
      let catalogItemsFound = 0;
      
      if (assistantMessage.tool_calls && assistantMessage.tool_calls.length > 0) {
        for (const toolCall of assistantMessage.tool_calls) {
          if (toolCall.function.name === "searchFaqs") {
            databaseQueried = true;
            console.log("\n🔍 [FERRAMENTA ACIONADA] searchFaqs foi chamada!");

            const args = JSON.parse(toolCall.function.arguments || "{}");
            console.log("   Buscando por:", args.query);

            const results = await storage.searchFaqs(args.query, args.limit || 5);
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

            messages.push({
              role: "system",
              content: `Resultados da busca para "${args.query}": ${JSON.stringify(results)}`,
            });
          } else if (toolCall.function.name === "searchCatalog") {
            databaseQueried = true;
            console.log("\n🔍 [FERRAMENTA ACIONADA] searchCatalog foi chamada!");

            const args = JSON.parse(toolCall.function.arguments || "{}");
            console.log("   Buscando produtos por:", args.query);

            const results = await storage.searchCatalog(args.query, args.limit || 5);
            catalogItemsFound = results.length;

            if (results.length > 0) {
              console.log("\n✅ [CATÁLOGO] Itens encontrados! Total:", results.length);
              results.forEach((item, idx) => {
                console.log(`     ${idx + 1}. ${item.name} - R$${item.price.toFixed(2)} (${item.category})`);
              });
            } else {
              console.log("\n❌ [CATÁLOGO] Nenhum item encontrado para esta busca");
            }

            const summary = results
              .map((item) => {
                const tagList = item.tags.join(", ") || "sem tags";
                return `${item.name} | ${item.category} | ${item.manufacturer} | R$${item.price.toFixed(2)} | Tags: ${tagList} | ${item.description}`;
              })
              .join(" || ");

            messages.push({
              role: "system",
              content: results.length > 0
                ? `Itens do catálogo para "${args.query}": ${summary}`
                : `Nenhum item do catálogo encontrado para "${args.query}".`,
            });
          }
        }
      } else {
        console.log("\n⚠️  [AI] A IA decidiu NÃO consultar o banco de dados para esta pergunta");
      }

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
          model: "x-ai/grok-4.1-fast:free",
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
          message: databaseQueried 
            ? `✅ Dados do banco consultados (FAQs: ${faqsFound}, Catálogo: ${catalogItemsFound})`
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
