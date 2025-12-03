import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type LogEntry = {
  id: number;
  level: "log" | "info" | "warn" | "error";
  message: string;
  timestamp: string;
};

const MAX_CLIENT_LOGS = 400;
const LEVEL_COLORS: Record<LogEntry["level"], string> = {
  log: "text-slate-200",
  info: "text-blue-200",
  warn: "text-yellow-200",
  error: "text-red-200",
};

interface LogTerminalProps {
  className?: string;
}

export default function LogTerminal({ className }: LogTerminalProps) {
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [connected, setConnected] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const source = new EventSource("/api/logs/stream");

    source.onopen = () => setConnected(true);
    source.onerror = () => setConnected(false);
    source.onmessage = (event) => {
      if (!event.data) return;
      try {
        const entry = JSON.parse(event.data) as LogEntry;
        setLogs((prev) => {
          const next = [...prev, entry];
          if (next.length > MAX_CLIENT_LOGS) {
            next.shift();
          }
          return next;
        });
      } catch (error) {
        console.warn("Ignorando log inválido", error);
      }
    };

    return () => {
      source.close();
    };
  }, []);

  useEffect(() => {
    if (!autoScroll) return;
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [logs, autoScroll]);

  const handleClear = () => setLogs([]);
  const toggleAutoScroll = () => setAutoScroll((prev) => !prev);

  return (
    <Card className={cn("p-4 bg-slate-950 text-slate-50 border-slate-800 flex flex-col", className)}>
      <div className="flex items-center justify-between mb-3 flex-wrap gap-2 shrink-0">
        <div>
          <p className="text-sm font-semibold">Terminal em tempo real</p>
          <p className={`text-xs ${connected ? "text-emerald-300" : "text-red-300"}`}>
            {connected ? "Conectado aos logs do servidor" : "Reconectando..."}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={toggleAutoScroll}>
            {autoScroll ? "Pausar" : "Retomar"}
          </Button>
          <Button variant="outline" size="sm" onClick={handleClear}>
            Limpar
          </Button>
        </div>
      </div>
      <div
        ref={containerRef}
        className={cn(
          "overflow-y-auto rounded border border-slate-800 bg-black/60 font-mono text-xs",
          className ? "flex-1 min-h-0" : "h-[32rem]"
        )}
      >
        {logs.length === 0 ? (
          <p className="p-4 text-slate-400">
            Aguardando logs... interaja com o sistema para ver as mensagens aqui.
          </p>
        ) : (
          logs.map((log) => {
            const time = new Date(log.timestamp).toLocaleTimeString("pt-BR", {
              hour12: false,
            });
            return (
              <div key={log.id} className="border-b border-white/5 px-3 py-1.5">
                <span className="text-slate-500">[{time}]</span>{" "}
                <span className={`${LEVEL_COLORS[log.level]} uppercase`}>{log.level}</span>{" "}
                <span className="text-slate-100">{log.message}</span>
              </div>
            );
          })
        )}
        <div ref={endRef} />
      </div>
    </Card>
  );
}
