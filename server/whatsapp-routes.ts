import crypto from "node:crypto";
import type { Express, Request } from "express";

type TextMessage = {
  id: string;
  from: string;
  body: string;
};

const DEFAULT_API_VERSION = "v20.0";
const DEFAULT_MESSAGE_TTL_MS = 15 * 60 * 1000;
const DEFAULT_MAX_MESSAGE_CACHE = 500;

function getRawBody(req: Request): Buffer | undefined {
  const rawBody = (req as Request & { rawBody?: unknown }).rawBody;

  if (Buffer.isBuffer(rawBody)) return rawBody;
  if (typeof rawBody === "string") return Buffer.from(rawBody, "utf8");
  return undefined;
}

function toBuffer(payload: unknown): Buffer {
  if (Buffer.isBuffer(payload)) return payload;
  if (typeof payload === "string") return Buffer.from(payload, "utf8");
  return Buffer.from(JSON.stringify(payload ?? ""), "utf8");
}

export function verifyWhatsAppSignature(appSecret: string, payload: unknown, headerSignature: string | undefined): boolean {
  if (!appSecret || !headerSignature) return false;

  const rawPayload = toBuffer(payload);
  const computed = crypto
    .createHmac("sha256", appSecret)
    .update(rawPayload)
    .digest("hex");

  const expected = `sha256=${computed}`;
  const received = headerSignature.trim();

  if (expected.length !== received.length) {
    return false;
  }

  try {
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(received));
  } catch {
    return false;
  }
}

export function extractTextMessages(payload: unknown): TextMessage[] {
  const messages: TextMessage[] = [];
  const entries = (payload as { entry?: unknown[] })?.entry;

  if (!Array.isArray(entries)) return messages;

  for (const entry of entries) {
    const changes = (entry as { changes?: unknown[] })?.changes;
    if (!Array.isArray(changes)) continue;

    for (const change of changes) {
      const value = (change as { value?: Record<string, any> })?.value;
      const rawMessages = value?.messages;

      if (!Array.isArray(rawMessages)) continue;

      for (const message of rawMessages) {
        const id = (message as Record<string, unknown>)?.id;
        const from = (message as Record<string, unknown>)?.from;
        const body = (message as Record<string, any>)?.text?.body;

        if (typeof id === "string" && typeof from === "string" && typeof body === "string" && body.trim()) {
          messages.push({ id, from, body: body.trim() });
        }
      }
    }
  }

  return messages;
}

export class MessageIdCache {
  private seen = new Map<string, number>();

  constructor(
    private now: () => number = () => Date.now(),
    private ttlMs: number = DEFAULT_MESSAGE_TTL_MS,
    private maxEntries: number = DEFAULT_MAX_MESSAGE_CACHE,
  ) {}

  has(id: string): boolean {
    this.prune();
    return this.seen.has(id);
  }

  remember(id: string): void {
    this.prune();
    this.seen.set(id, this.now());
  }

  delete(id: string): void {
    this.seen.delete(id);
  }

  private prune(): void {
    const cutoff = this.now() - this.ttlMs;
    for (const [messageId, timestamp] of this.seen.entries()) {
      if (timestamp < cutoff) {
        this.seen.delete(messageId);
      }
    }

    if (this.seen.size <= this.maxEntries) return;

    const sorted = Array.from(this.seen.entries()).sort((a, b) => a[1] - b[1]);
    while (sorted.length > this.maxEntries) {
      const [oldestId] = sorted.shift() ?? [];
      if (oldestId) {
        this.seen.delete(oldestId);
      }
    }
  }
}

export type ChatCaller = (params: { sessionId: string; message: string }) => Promise<string>;

export type WhatsAppSender = (params: { to: string; body: string }) => Promise<void>;

export function createChatCaller(baseUrl: string): ChatCaller {
  const target = new URL("/api/chat", baseUrl);

  return async ({ sessionId, message }) => {
    const response = await fetch(target, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-WhatsApp-Session": sessionId,
      },
      body: JSON.stringify({ message }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Falha ao chamar /api/chat (${response.status}): ${errorBody}`);
    }

    const data = await response.json();
    const reply = data?.response ?? data?.reply;
    if (typeof reply !== "string" || !reply.trim()) {
      throw new Error("Resposta inválida de /api/chat (campo response ausente).");
    }

    return reply;
  };
}

export function createWhatsAppSender(params: {
  accessToken: string;
  phoneNumberId: string;
  apiVersion?: string;
}): WhatsAppSender {
  const { accessToken, phoneNumberId, apiVersion = DEFAULT_API_VERSION } = params;
  const baseUrl = `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`;

  return async ({ to, body }) => {
    const response = await fetch(baseUrl, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        to,
        type: "text",
        text: { body },
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text();
      throw new Error(`Erro ao enviar mensagem ao WhatsApp (${response.status}): ${errorBody}`);
    }
  };
}

type RegisterOptions = {
  verifyToken?: string;
  appSecret?: string;
  accessToken?: string;
  phoneNumberId?: string;
  chatBaseUrl?: string;
  apiVersion?: string;
  callChat?: ChatCaller;
  sendMessage?: WhatsAppSender;
  messageCache?: MessageIdCache;
  now?: () => number;
  logger?: Pick<typeof console, "log" | "error" | "warn">;
};

export function registerWhatsAppRoutes(app: Express, options?: RegisterOptions) {
  const verifyToken = options?.verifyToken ?? process.env.WHATSAPP_VERIFY_TOKEN ?? "";
  const appSecret = options?.appSecret ?? process.env.WHATSAPP_APP_SECRET ?? "";
  const accessToken = options?.accessToken ?? process.env.WHATSAPP_ACCESS_TOKEN ?? "";
  const phoneNumberId = options?.phoneNumberId ?? process.env.WHATSAPP_PHONE_NUMBER_ID ?? "";
  const apiVersion = options?.apiVersion ?? DEFAULT_API_VERSION;
  const chatBaseUrl = options?.chatBaseUrl ?? process.env.WHATSAPP_CHAT_BASE_URL ?? `http://localhost:${process.env.PORT || "3000"}`;
  const logger = options?.logger ?? console;
  const messageCache = options?.messageCache ?? new MessageIdCache(options?.now);

  const callChat = options?.callChat ?? createChatCaller(chatBaseUrl);
  const sendMessage = options?.sendMessage ?? createWhatsAppSender({ accessToken, phoneNumberId, apiVersion });

  app.get("/webhooks/whatsapp", (req, res) => {
    const mode = req.query["hub.mode"];
    const token = req.query["hub.verify_token"];
    const challenge = req.query["hub.challenge"];

    const isSubscribed = mode === "subscribe" || mode === "subscriptions";
    const isVerified = token === verifyToken && typeof challenge === "string";

    if (isSubscribed && isVerified) {
      logger.log("[WHATSAPP] Webhook verificado via hub.challenge");
      return res.status(200).send(challenge as string);
    }

    return res.status(403).json({ error: "Verificação do webhook falhou" });
  });

  app.post("/webhooks/whatsapp", async (req, res) => {
    if (!verifyToken || !appSecret || !accessToken || !phoneNumberId) {
      logger.error("[WHATSAPP] Variáveis de ambiente ausentes para o webhook.");
      return res.status(500).json({ error: "Configuração do WhatsApp incompleta." });
    }

    const signature = req.get("x-hub-signature-256") ?? req.get("X-Hub-Signature-256");
    const rawBody = getRawBody(req) ?? req.body;

    const isValidSignature = verifyWhatsAppSignature(appSecret, rawBody, signature ?? undefined);
    if (!isValidSignature) {
      logger.warn("[WHATSAPP] Assinatura inválida recebida no webhook.");
      return res.status(401).json({ error: "Assinatura inválida" });
    }

    const incomingMessages = extractTextMessages(req.body);
    if (incomingMessages.length === 0) {
      logger.log("[WHATSAPP] Payload recebido sem mensagens de texto. Ignorando.");
      return res.status(200).json({ status: "ignored" });
    }

    const incoming = incomingMessages[0];

    if (messageCache.has(incoming.id)) {
      logger.log(`[WHATSAPP] Mensagem duplicada detectada (${incoming.id}). Ignorando.`);
      return res.status(200).json({ status: "duplicate" });
    }

    messageCache.remember(incoming.id);

    try {
      const reply = await callChat({ sessionId: `wa:${incoming.from}`, message: incoming.body });
      await sendMessage({ to: incoming.from, body: reply });

      return res.status(200).json({ status: "sent" });
    } catch (error) {
      messageCache.delete(incoming.id);
      logger.error("[WHATSAPP] Erro ao processar webhook:", error);
      return res.status(500).json({ error: "Erro ao processar mensagem do WhatsApp" });
    }
  });
}
