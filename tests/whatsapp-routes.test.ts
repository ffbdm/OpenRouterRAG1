import assert from "node:assert/strict";
import crypto from "node:crypto";
import { AddressInfo } from "node:net";
import { test } from "node:test";
import express from "express";

import { MessageIdCache, registerWhatsAppRoutes, verifyWhatsAppSignature } from "../server/whatsapp-routes";

function signPayload(secret: string, payload: unknown): string {
  const raw = typeof payload === "string" ? payload : JSON.stringify(payload);
  const digest = crypto.createHmac("sha256", secret).update(raw).digest("hex");
  return `sha256=${digest}`;
}

function buildTestApp(overrides?: Parameters<typeof registerWhatsAppRoutes>[1]) {
  const app = express();
  app.use(express.json({
    verify: (req, _res, buf) => {
      (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
    },
  }));
  app.use(express.urlencoded({ extended: false }));
  registerWhatsAppRoutes(app, overrides);

  const server = app.listen(0);
  const { port } = server.address() as AddressInfo;
  const url = `http://127.0.0.1:${port}`;

  return { server, url };
}

test("verifyWhatsAppSignature valida assinatura gerada com app secret", () => {
  const secret = "my-app-secret";
  const payload = { hello: "world" };
  const signature = signPayload(secret, payload);

  assert.equal(verifyWhatsAppSignature(secret, payload, signature), true);
  assert.equal(verifyWhatsAppSignature(secret, payload, "sha256=invalid"), false);
});

test("GET /webhooks/whatsapp responde com hub.challenge quando verify_token confere", async () => {
  const { server, url } = buildTestApp({
    verifyToken: "token-123",
    appSecret: "app-secret",
    accessToken: "access",
    phoneNumberId: "phone",
    sendMessage: async () => {},
    callChat: async () => "ok",
  });

  const response = await fetch(`${url}/webhooks/whatsapp?hub.mode=subscribe&hub.verify_token=token-123&hub.challenge=CHALLENGE`);
  const text = await response.text();

  assert.equal(response.status, 200);
  assert.equal(text, "CHALLENGE");

  server.close();
});

test("POST /webhooks/whatsapp processa texto, aciona /api/chat e evita duplicidade", async () => {
  const appSecret = "app-secret";
  const cache = new MessageIdCache();
  let chatCalls = 0;
  let sendCalls = 0;

  const { server, url } = buildTestApp({
    verifyToken: "token-123",
    appSecret,
    accessToken: "access",
    phoneNumberId: "phone",
    messageCache: cache,
    callChat: async ({ sessionId, message }) => {
      chatCalls += 1;
      assert.equal(sessionId, "wa:5511");
      assert.equal(message, "Olá!");
      return "Resposta pronta";
    },
    sendMessage: async ({ to, body }) => {
      sendCalls += 1;
      assert.equal(to, "5511");
      assert.equal(body, "Resposta pronta");
    },
  });

  const payload = {
    entry: [{
      changes: [{
        value: {
          messages: [{
            id: "mid-1",
            from: "5511",
            text: { body: "Olá!" },
          }],
        },
      }],
    }],
  };

  const signature = signPayload(appSecret, payload);

  const firstResponse = await fetch(`${url}/webhooks/whatsapp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Hub-Signature-256": signature,
    },
    body: JSON.stringify(payload),
  });

  assert.equal(firstResponse.status, 200);
  assert.deepEqual(await firstResponse.json(), { status: "sent" });
  assert.equal(chatCalls, 1);
  assert.equal(sendCalls, 1);

  const duplicateResponse = await fetch(`${url}/webhooks/whatsapp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Hub-Signature-256": signature,
    },
    body: JSON.stringify(payload),
  });

  assert.equal(duplicateResponse.status, 200);
  assert.deepEqual(await duplicateResponse.json(), { status: "duplicate" });
  assert.equal(chatCalls, 1);
  assert.equal(sendCalls, 1);

  server.close();
});

test("POST /webhooks/whatsapp rejeita assinatura inválida", async () => {
  const { server, url } = buildTestApp({
    verifyToken: "token-123",
    appSecret: "app-secret",
    accessToken: "access",
    phoneNumberId: "phone",
    sendMessage: async () => {
      throw new Error("não deve ser chamado");
    },
    callChat: async () => {
      throw new Error("não deve ser chamado");
    },
  });

  const payload = {
    entry: [{
      changes: [{
        value: {
          messages: [{
            id: "mid-1",
            from: "5511",
            text: { body: "Olá!" },
          }],
        },
      }],
    }],
  };

  const response = await fetch(`${url}/webhooks/whatsapp`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Hub-Signature-256": "sha256=invalid",
    },
    body: JSON.stringify(payload),
  });

  assert.equal(response.status, 401);

  server.close();
});
