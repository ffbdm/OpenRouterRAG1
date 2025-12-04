import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import LogTerminal from "@/components/LogTerminal";
import { MarkdownMessage } from "@/components/MarkdownMessage";
import { Send, Bot, User } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

type Message = {
  role: "user" | "assistant";
  content: string;
};

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const chatMutation = useMutation({
    mutationFn: async (message: string) => {
      const response = await apiRequest("POST", "/api/chat", { message });
      const data = await response.json();
      if (data.debug) {
        console.log("📊 Informação do Banco de Dados:", data.debug.message);
        console.log("   Consultou banco?", data.debug.databaseQueried);
        console.log("   Resultados encontrados:", data.debug.faqsFound);
      }
      return data;
    },
    onSuccess: (data) => {
      const debugInfo = data.debug?.message || "";
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.response },
      ]);
      if (debugInfo) {
        console.log("✨ Status da Consulta:", debugInfo);
      }
    },
    onError: (error) => {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Desculpe, ocorreu um erro ao processar sua mensagem." },
      ]);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || chatMutation.isPending) return;

    const userMessage = input.trim();
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setInput("");
    chatMutation.mutate(userMessage);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className={cn(
      "flex flex-col max-w-7xl mx-auto h-full",
      isMobile ? "p-2" : "p-6 gap-6"
    )}>
      <header className={cn("border-b shrink-0", isMobile ? "pb-2 mb-2" : "pb-4 mb-6")}>
        <h1 className={cn("font-semibold text-foreground", isMobile ? "text-lg" : "text-xl")}>
          {isMobile ? "Chat FAQ" : "Assistente de FAQ com RAG"}
        </h1>
        {!isMobile && (
          <>
            <p className="text-sm text-muted-foreground mt-1">
              Sistema de chat com Retrieval-Augmented Generation usando OpenRouter
            </p>
            <p className="text-xs text-muted-foreground mt-3 bg-muted p-2 rounded">
              💡 Dica: Utilize o terminal em tempo real à direita para acompanhar os logs do servidor sem sair da aplicação.
            </p>
          </>
        )}
      </header>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(600px,1.5fr)] flex-1 items-start min-h-0 overflow-hidden">
        <section className={cn(
          "flex flex-col rounded-lg bg-card h-full min-h-0",
          isMobile ? "border-0 shadow-none" : "border p-4 shadow-sm"
        )}>
          <div className={cn(
            "flex-1 overflow-y-auto flex flex-col gap-4 pr-2 min-h-0",
            isMobile ? "mb-2" : "mb-4"
          )}>
            {messages.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Bot className="h-12 w-12 text-muted-foreground mb-4" />
                <h2 className="text-lg font-medium text-foreground mb-2">
                  Comece uma conversa
                </h2>
                <p className="text-sm text-muted-foreground max-w-md">
                  Faça perguntas sobre o sistema. A IA irá buscar informações na
                  base de conhecimento para fornecer respostas precisas.
                </p>
              </div>
            ) : (
              messages.map((message, index) => (
                <div
                  key={index}
                  className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                  data-testid={`message-${message.role}-${index}`}
                >
                  <div
                    className={`flex gap-3 max-w-[90%] md:max-w-[80%] ${message.role === "user" ? "flex-row-reverse" : "flex-row"}`}
                  >
                    <div className="flex-shrink-0">
                      {message.role === "user" ? (
                        <div className="h-8 w-8 rounded-full bg-primary flex items-center justify-center">
                          <User className="h-4 w-4 text-primary-foreground" />
                        </div>
                      ) : (
                        <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                          <Bot className="h-4 w-4 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <Card
                      className={`p-3 md:p-4 ${message.role === "user" ? "bg-primary text-primary-foreground border-primary-border" : ""}`}
                    >
                      {message.role === "user" ? (
                        <p className="text-sm leading-relaxed whitespace-pre-wrap">
                          {message.content}
                        </p>
                      ) : (
                        <MarkdownMessage content={message.content} />
                      )}
                    </Card>
                  </div>
                </div>
              ))
            )}

            {chatMutation.isPending && (
              <div className="flex gap-3 justify-start" data-testid="loading-message">
                <div className="flex gap-3 max-w-[90%] md:max-w-[80%]">
                  <div className="flex-shrink-0">
                    <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
                      <Bot className="h-4 w-4 text-muted-foreground animate-pulse" />
                    </div>
                  </div>
                  <Card className="p-3 md:p-4">
                    <p className="text-sm text-muted-foreground">
                      Processando sua pergunta...
                    </p>
                  </Card>
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          <form
            onSubmit={handleSubmit}
            className={cn(
              "bg-background",
              isMobile ? "pt-2" : "border-t pt-4"
            )}
          >
            <div className="flex gap-3">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Digite sua pergunta..."
                className={cn(
                  "resize-none",
                  isMobile ? "min-h-[50px] max-h-[120px]" : "min-h-[80px]"
                )}
                disabled={chatMutation.isPending}
                data-testid="input-message"
              />
              <Button
                type="submit"
                size="icon"
                disabled={!input.trim() || chatMutation.isPending}
                className={cn(
                  isMobile ? "h-[50px] w-12" : "h-[80px] w-12"
                )}
                data-testid="button-send"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
            {!isMobile && (
              <p className="text-xs text-muted-foreground mt-2">
                A IA usa function calling para consultar o banco de dados PostgreSQL
                quando necessário
              </p>
            )}
          </form>
        </section>

        {!isMobile && (
          <div className="sticky top-6 self-start w-full">
            <LogTerminal />
          </div>
        )}
      </div>
    </div>
  );
}
