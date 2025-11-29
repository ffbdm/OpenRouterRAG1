import { test } from "node:test";
import assert from "node:assert/strict";
import { formatPriceBRL, parseTagsInput, statusLabel } from "../client/src/lib/catalog";

test("parseTagsInput converte string em lista de tags normalizadas", () => {
  const tags = parseTagsInput(" sementes, soja , fertilizante ,,  ");
  assert.deepEqual(tags, ["sementes", "soja", "fertilizante"]);
});

test("parseTagsInput lida com arrays e valores vazios", () => {
  assert.deepEqual(parseTagsInput(["bio ", " nitrogenio", ""]), ["bio", "nitrogenio"]);
  assert.deepEqual(parseTagsInput(""), []);
  assert.deepEqual(parseTagsInput(undefined), []);
});

test("formatPriceBRL gera moeda com separador brasileiro", () => {
  const formatted = formatPriceBRL(1234.5);
  assert.equal(formatted.startsWith("R$"), true);
  assert.equal(formatted.includes("1.234"), true);
});

test("statusLabel traduz estados para PT-BR", () => {
  assert.equal(statusLabel("ativo"), "Ativo");
  assert.equal(statusLabel("arquivado"), "Arquivado");
});
