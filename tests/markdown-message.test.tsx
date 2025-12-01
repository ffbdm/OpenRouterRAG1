import { test } from "node:test";
import assert from "node:assert/strict";
import { renderToStaticMarkup } from "react-dom/server";
import React from "react";
import { MarkdownMessage } from "../client/src/components/MarkdownMessage";

const render = (content: string) =>
  renderToStaticMarkup(<MarkdownMessage content={content} />);

test("renderiza elementos básicos de Markdown", () => {
  const html = render(`**Negrito** e listas:\n- Item 1\n- Item 2`);

  assert.match(html, /<strong>Negrito<\/strong>/);
  assert.match(html, /<ul>/);
  assert.match(html, /<li>Item 1<\/li>/);
});

test("suporta tabelas e código com GFM", () => {
  const html = render(`| Coluna | Valor |\n| --- | --- |\n| A | 42 |\n\n\`\`\`ts\nconst x = 1;\n\`\`\``);

  assert.match(html, /<table/);
  assert.match(html, /<code[^>]*>const x = 1;<\/code>/);
});

test("remove HTML potencialmente perigoso", () => {
  const html = render("<script>alert('xss')</script>Conteúdo seguro");

  assert.ok(!html.includes("<script"));
  assert.ok(html.includes("Conteúdo seguro"));
});
