import { test } from "node:test";
import assert from "node:assert/strict";
import { formatToolLogMessage, summarizeAiPayload } from "../server/tool-logger";

test("summarizeAiPayload trims whitespace and preserves short payloads", () => {
  const payload = "  Resultado  com   espaços   extras  ";
  const { preview, truncated } = summarizeAiPayload(payload);

  assert.equal(preview, "Resultado com espaços extras");
  assert.equal(truncated, false);
});

test("summarizeAiPayload truncates payloads above the limit", () => {
  const payload = "x".repeat(900);
  const { preview, truncated } = summarizeAiPayload(payload, 100);

  assert.equal(preview.length, 101); // inclui ellipsis
  assert.equal(preview.endsWith("…"), true);
  assert.equal(truncated, true);
});

test("formatToolLogMessage agrega metadados úteis", () => {
  const payload = formatToolLogMessage({
    toolName: "searchFaqs",
    args: { query: "frete", limit: 3 },
    resultCount: 2,
    aiPayload: "Itens retornados"
  });

  assert.equal(payload.label.includes("searchFaqs"), true);
  assert.deepEqual(payload.args, { query: "frete", limit: 3 });
  assert.equal(payload.resultCount, 2);
  assert.equal(payload.preview, "Itens retornados");
  assert.equal(payload.truncated, false);
});
