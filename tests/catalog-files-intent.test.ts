import { test } from "node:test";
import assert from "node:assert/strict";

import { inferUseCatalogFiles } from "../server/catalog-files-intent";

test("inferUseCatalogFiles retorna true para pedidos típicos de documentos/anexos", () => {
  assert.equal(inferUseCatalogFiles("Você tem a FISPQ do produto NitroFix?"), true);
  assert.equal(inferUseCatalogFiles("Me envie a ficha técnica em PDF"), true);
  assert.equal(inferUseCatalogFiles("Qual a composição e a dose recomendada?"), true);
  assert.equal(inferUseCatalogFiles("Quero a tabela de ppm do anexo"), true);
});

test("inferUseCatalogFiles retorna false para perguntas gerais de catálogo", () => {
  assert.equal(inferUseCatalogFiles("Qual o preço do NitroFix?"), false);
  assert.equal(inferUseCatalogFiles("Me indique um inseticida para lagarta"), false);
  assert.equal(inferUseCatalogFiles("Quais são as tags do MaxK?"), false);
});

