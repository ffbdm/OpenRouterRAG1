import { EventEmitter } from "node:events";

export type LogEntry = {
  id: number;
  level: "log" | "info" | "warn" | "error";
  message: string;
  timestamp: string;
};

const MAX_LOGS = 500;
const logBuffer: LogEntry[] = [];
const logEmitter = new EventEmitter();
let nextId = 1;
let consolePatched = false;

type ConsoleMethod = "log" | "info" | "warn" | "error";

const originalConsole: Record<ConsoleMethod, (...args: unknown[]) => void> = {
  log: console.log.bind(console),
  info: console.info.bind(console),
  warn: console.warn.bind(console),
  error: console.error.bind(console),
};

function formatArg(arg: unknown): string {
  if (typeof arg === "string") return arg;
  if (typeof arg === "number" || typeof arg === "boolean" || arg === null || arg === undefined) {
    return String(arg);
  }
  if (arg instanceof Error) {
    return `${arg.name}: ${arg.message}`;
  }

  try {
    return JSON.stringify(arg);
  } catch (error) {
    return `[unserializable:${typeof arg}]`;
  }
}

function recordEntry(level: LogEntry["level"], args: unknown[]): void {
  const message = args.map(formatArg).join(" ");
  const entry: LogEntry = {
    id: nextId++,
    level,
    message,
    timestamp: new Date().toISOString(),
  };

  logBuffer.push(entry);
  if (logBuffer.length > MAX_LOGS) {
    logBuffer.shift();
  }

  logEmitter.emit("log", entry);
}

function patchConsole(): void {
  if (consolePatched) return;
  consolePatched = true;

  (Object.keys(originalConsole) as ConsoleMethod[]).forEach((method) => {
    (console as Console)[method] = ((...args: unknown[]) => {
      originalConsole[method](...args);
      recordEntry(method, args);
    }) as Console["log"];
  });
}

patchConsole();

export function getBufferedLogs(): LogEntry[] {
  return [...logBuffer];
}

export function subscribeToLogs(listener: (entry: LogEntry) => void): () => void {
  logEmitter.on("log", listener);
  return () => logEmitter.off("log", listener);
}

export { logEmitter };
