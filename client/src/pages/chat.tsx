import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import LogTerminal from "@/components/LogTerminal";
import { MarkdownMessage } from "@/components/MarkdownMessage";
import { Send, Bot, User, Sparkles, Database, Terminal } from "lucide-react";
import { useMutation } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

type Message = {
  role: "user" | "assistant";
  content: string;
};

type ChatPayload = {
  message: string;
  history: Message[];
};

const MAX_HISTORY_MESSAGES = 12;

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Focus input on mount
  useEffect(() => {
    if (!isMobile) {
      inputRef.current?.focus();
    }
  }, [isMobile]);

  const chatMutation = useMutation({
    mutationFn: async ({ message, history }: ChatPayload) => {
      const response = await apiRequest("POST", "/api/chat", { message, history });
      const data = await response.json();
      return data;
    },
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: data.response },
      ]);
    },
    onError: (error) => {
      console.error("Chat error:", error);
      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: "Apologies, I encountered an error processing your request." },
      ]);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || chatMutation.isPending) return;

    const userMessage = input.trim();
    const history = messages.slice(-MAX_HISTORY_MESSAGES);
    setMessages((prev) => [...prev, { role: "user", content: userMessage }]);
    setInput("");
    chatMutation.mutate({ message: userMessage, history });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <div className="flex h-full gap-6">
      {/* Chat Area */}
      <div className="flex-1 flex flex-col h-full min-w-0">
        <div className="flex-1 overflow-y-auto no-scrollbar pr-2 py-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center space-y-6 pt-10 opacity-0 animate-fade-in" style={{ animationDelay: '0.2s', animationFillMode: 'forwards' }}>
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 blur-3xl rounded-full" />
                <div className="relative glass p-6 rounded-3xl border-white/10 shadow-xl">
                  <Bot className="h-16 w-16 text-primary" />
                </div>
              </div>
              <div className="space-y-2 max-w-md px-4">
                <h2 className="text-3xl font-display font-bold bg-clip-text text-transparent bg-gradient-to-r from-blue-500 to-purple-500">
                  How can I help you?
                </h2>
                <p className="text-muted-foreground text-lg leading-relaxed">
                  I can analyze your database and answer questions using RAG technology.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-lg px-4 mt-8">
                {["List all catalog items", "Search for high value products", "What is the system status?", "How does RAG work?"].map((suggestion, i) => (
                  <button
                    key={i}
                    onClick={() => {
                      setInput(suggestion);
                      inputRef.current?.focus();
                    }}
                    className="glass-button p-3 rounded-xl text-sm font-medium text-left hover:scale-[1.02] active:scale-[0.98] transition-all border border-white/5 bg-white/5 text-foreground hover:bg-white/10 hover:text-primary"
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-6 pb-4">
              <AnimatePresence>
                {messages.map((message, index) => (
                  <motion.div
                    key={index}
                    initial={{ opacity: 0, y: 20, scale: 0.95 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.3, ease: "easeOut" }}
                    className={cn(
                      "flex gap-4 w-full max-w-3xl mx-auto",
                      message.role === "user" ? "justify-end" : "justify-start"
                    )}
                  >
                    <div className={cn(
                      "flex gap-3 max-w-[90%] md:max-w-[85%]",
                      message.role === "user" ? "flex-row-reverse" : "flex-row"
                    )}>
                      {/* Avatar */}
                      <div className="flex-shrink-0 mt-1">
                        <div className={cn(
                          "h-8 w-8 rounded-full flex items-center justify-center shadow-md",
                          message.role === "user"
                            ? "bg-gradient-to-tr from-blue-500 to-cyan-400"
                            : "glass bg-white/10 border-white/20"
                        )}>
                          {message.role === "user" ? (
                            <User className="h-4 w-4 text-white" />
                          ) : (
                            <Sparkles className="h-4 w-4 text-purple-400" />
                          )}
                        </div>
                      </div>

                      {/* Message Bubble */}
                      <div className={cn(
                        "relative p-4 md:p-5 shadow-sm overflow-hidden group",
                        message.role === "user"
                          ? "bg-gradient-to-br from-primary to-blue-600 text-primary-foreground rounded-2xl rounded-tr-sm"
                          : "glass-card text-foreground rounded-2xl rounded-tl-sm border-white/10"
                      )}>
                        {message.role === "assistant" && (
                          <div className="absolute -right-10 -top-10 w-24 h-24 bg-purple-500/10 blur-2xl rounded-full group-hover:bg-purple-500/20 transition-all duration-500" />
                        )}

                        <div className="relative z-10 text-[15px] leading-relaxed">
                          {message.role === "user" ? (
                            <p className="whitespace-pre-wrap font-medium font-sans">{message.content}</p>
                          ) : (
                            <div className="prose prose-sm dark:prose-invert prose-p:text-foreground/90 prose-headings:text-foreground prose-strong:text-foreground/90 max-w-none">
                              <MarkdownMessage content={message.content} />
                            </div>
                          )}
                        </div>

                        <div className={cn(
                          "text-[10px] opacity-0 group-hover:opacity-60 transition-opacity absolute bottom-1",
                          message.role === "user" ? "left-2 text-primary-foreground" : "right-3 text-muted-foreground"
                        )}>
                          {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>

              {chatMutation.isPending && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex gap-4 w-full max-w-3xl mx-auto justify-start"
                >
                  <div className="flex gap-3 max-w-[85%] flex-row">
                    <div className="h-8 w-8 rounded-full glass bg-white/10 flex items-center justify-center mt-1">
                      <Sparkles className="h-4 w-4 text-purple-400 animate-pulse" />
                    </div>
                    <div className="glass-card px-4 py-3 rounded-2xl rounded-tl-sm border-white/10 flex items-center gap-2">
                      <span className="flex gap-1 h-2 items-center">
                        <span className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                        <span className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                        <span className="w-1.5 h-1.5 bg-foreground/40 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                      </span>
                      <span className="text-xs text-muted-foreground font-medium ml-1">Thinking...</span>
                    </div>
                  </div>
                </motion.div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Input Area */}
        <div className="shrink-0 pt-4 pb-2 z-20">
          <form
            onSubmit={handleSubmit}
            className="w-full max-w-3xl mx-auto relative group"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-blue-500/20 to-purple-500/20 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
            <div className="glass rounded-2xl flex items-end gap-2 p-2 relative bg-background/40 hover:bg-background/60 focus-within:bg-background/80 transition-all border-white/10 focus-within:border-primary/30 focus-within:shadow-[0_0_20px_rgba(37,99,235,0.15)]">
              <Textarea
                ref={inputRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Ask anything about the catalog..."
                className="min-h-[50px] max-h-[140px] resize-none border-0 bg-transparent focus-visible:ring-0 px-4 py-3 text-base placeholder:text-muted-foreground/50 shadow-none no-scrollbar flex-1"
                disabled={chatMutation.isPending}
              />
              <Button
                type="submit"
                disabled={!input.trim() || chatMutation.isPending}
                className={cn(
                  "mb-1 h-10 w-10 rounded-xl transition-all duration-300",
                  !input.trim()
                    ? "bg-transparent text-muted-foreground hover:bg-muted/20"
                    : "bg-primary text-primary-foreground hover:scale-105 active:scale-95 shadow-md shadow-primary/25"
                )}
              >
                <Send className="h-5 w-5 ml-0.5" />
              </Button>
            </div>

            {!isMobile && (
              <div className="absolute -bottom-6 left-0 right-0 text-center flex justify-center gap-4 text-[10px] text-muted-foreground/60 font-medium tracking-wide">
                <span className="flex items-center gap-1">
                  <Sparkles className="h-3 w-3" /> AI Powered
                </span>
                <span className="flex items-center gap-1">
                  <Database className="h-3 w-3" /> RAG Enabled
                </span>
              </div>
            )}
          </form>
        </div>
      </div>

      {/* Desktop Terminal Side Panel */}
      {!isMobile && (
        <div className="hidden xl:block w-[400px] shrink-0 h-full pl-6 border-l border-white/5">
          <div className="sticky top-0 h-full flex flex-col gap-4 py-4">
            <div className="flex items-center justify-between px-2">
              <h3 className="text-sm font-semibold text-muted-foreground flex items-center gap-2">
                <Terminal className="h-4 w-4" /> Live System Logs
              </h3>
              <span className="flex h-2 w-2 rounded-full bg-green-500 shadow-[0_0_8px_rgb(34,197,94)] animate-pulse" />
            </div>
            <div className="flex-1 rounded-2xl overflow-hidden glass border-white/5 shadow-inner bg-black/40">
              <LogTerminal className="h-full text-xs" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
