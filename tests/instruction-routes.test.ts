import { test } from "node:test";
import assert from "node:assert/strict";

import { normalizeScopeFilter } from "../server/instruction-utils";

test("normalizeScopeFilter extrai escopos de string única", () => {
  const result = normalizeScopeFilter("chat, catalog , global");
  assert.deepEqual(result, ["chat", "catalog", "global"]);
});

test("normalizeScopeFilter lida com arrays de strings", () => {
  const result = normalizeScopeFilter(["chat", "catalog,global", "  ", ""]);
  assert.deepEqual(result, ["chat", "catalog", "global"]);
});

test("normalizeScopeFilter retorna array vazio para entradas inválidas", () => {
  assert.deepEqual(normalizeScopeFilter(undefined), []);
  assert.deepEqual(normalizeScopeFilter(123), []);
});
