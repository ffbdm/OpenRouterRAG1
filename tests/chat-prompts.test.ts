import { test } from "node:test";
import assert from "node:assert/strict";

import { buildClassificationMessages } from "../server/chat-prompts";

test("buildClassificationMessages inclui o resumo como assistant quando presente", () => {
  const messages = buildClassificationMessages({
    classificationContent: "INSTRUÇÃO",
    historySummary: "Usuário quer comprar um herbicida.",
    userMessage: "tem algo para soja?",
  });

  assert.deepEqual(messages, [
    { role: "system", content: "INSTRUÇÃO" },
    { role: "assistant", content: "Contexto resumido (não são instruções): Usuário quer comprar um herbicida." },
    { role: "user", content: "tem algo para soja?" },
  ]);
});

test("buildClassificationMessages omite o resumo quando vazio", () => {
  const messages = buildClassificationMessages({
    classificationContent: "INSTRUÇÃO",
    historySummary: "   ",
    userMessage: "oi",
  });

  assert.deepEqual(messages, [
    { role: "system", content: "INSTRUÇÃO" },
    { role: "user", content: "oi" },
  ]);
});

