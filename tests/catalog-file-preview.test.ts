import assert from "node:assert/strict";
import { Readable } from "node:stream";
import { test } from "node:test";
import JSZip from "jszip";
import type { Express } from "express";
import { DEFAULT_MAX_PREVIEW_LENGTH, extractTextPreview } from "../server/catalog-file-preview";

function buildMockFile(options: { buffer: Buffer; mimetype: string; originalname?: string }): Express.Multer.File {
  const { buffer, mimetype, originalname } = options;

  return {
    fieldname: "file",
    originalname: originalname ?? "file.bin",
    encoding: "7bit",
    mimetype,
    size: buffer.length,
    buffer,
    destination: "",
    filename: originalname ?? "file.bin",
    path: "",
    stream: Readable.from([]),
  };
}

function buildPdfBuffer(text: string): Buffer {
  const header = "%PDF-1.4\n";

  const catalog = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
  const pages = "2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n";
  const page = "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n";
  const contentStream = `BT /F1 18 Tf 50 750 Td (${text}) Tj ET`;
  const contents = `4 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream\nendobj\n`;
  const font = "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n";

  const objects = [catalog, pages, page, contents, font];
  const offsets = [0];
  let body = "";
  let position = header.length;

  for (const object of objects) {
    offsets.push(position);
    body += object;
    position += object.length;
  }

  const xrefStart = header.length + body.length;

  let xref = "xref\n0 6\n0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i++) {
    const padded = offsets[i].toString().padStart(10, "0");
    xref += `${padded} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;

  return Buffer.from(header + body + xref + trailer, "utf-8");
}

function escapePdfLiteral(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function buildPdfTableBuffer(rows: string[][], options?: { startX?: number; startY?: number; colGap?: number; rowGap?: number }): Buffer {
  const startX = options?.startX ?? 50;
  const startY = options?.startY ?? 750;
  const colGap = options?.colGap ?? 200;
  const rowGap = options?.rowGap ?? 22;

  const header = "%PDF-1.4\n";
  const catalog = "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n";
  const pages = "2 0 obj\n<< /Type /Pages /Count 1 /Kids [3 0 R] >>\nendobj\n";
  const page = "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\nendobj\n";

  const parts: string[] = ["BT /F1 12 Tf"];
  rows.forEach((row, rowIndex) => {
    const y = startY - rowIndex * rowGap;
    row.forEach((cell, colIndex) => {
      const x = startX + colIndex * colGap;
      parts.push(`1 0 0 1 ${x} ${y} Tm (${escapePdfLiteral(cell)}) Tj`);
    });
  });
  parts.push("ET");

  const contentStream = parts.join("\n");
  const contents = `4 0 obj\n<< /Length ${contentStream.length} >>\nstream\n${contentStream}\nendstream\nendobj\n`;
  const font = "5 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n";

  const objects = [catalog, pages, page, contents, font];
  const offsets = [0];
  let body = "";
  let position = header.length;

  for (const object of objects) {
    offsets.push(position);
    body += object;
    position += object.length;
  }

  const xrefStart = header.length + body.length;
  let xref = "xref\n0 6\n0000000000 65535 f \n";
  for (let i = 1; i < offsets.length; i++) {
    const padded = offsets[i].toString().padStart(10, "0");
    xref += `${padded} 00000 n \n`;
  }

  const trailer = `trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xrefStart}\n%%EOF`;
  return Buffer.from(header + body + xref + trailer, "utf-8");
}

async function buildDocxBuffer(text: string): Promise<Buffer> {
  const zip = new JSZip();

  zip.file("[Content_Types].xml", `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`);

  zip.folder("_rels")?.file(".rels", `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="R1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`);

  const word = zip.folder("word");
  word?.file("document.xml", `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<w:document xmlns:wpc="http://schemas.microsoft.com/office/word/2010/wordprocessingCanvas" xmlns:mc="http://schemas.openxmlformats.org/markup-compatibility/2006" xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:m="http://schemas.openxmlformats.org/officeDocument/2006/math" xmlns:v="urn:schemas-microsoft-com:vml" xmlns:wp14="http://schemas.microsoft.com/office/word/2010/wordprocessingDrawing" xmlns:wp="http://schemas.openxmlformats.org/drawingml/2006/wordprocessingDrawing" xmlns:w10="urn:schemas-microsoft-com:office:word" xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" xmlns:w14="http://schemas.microsoft.com/office/word/2010/wordml" xmlns:wpg="http://schemas.microsoft.com/office/word/2010/wordprocessingGroup" xmlns:wpi="http://schemas.microsoft.com/office/word/2010/wordprocessingInk" xmlns:wne="http://schemas.microsoft.com/office/word/2006/wordml" xmlns:wps="http://schemas.microsoft.com/office/word/2010/wordprocessingShape" mc:Ignorable="w14 wp14">
  <w:body>
    <w:p><w:r><w:t>${text}</w:t></w:r></w:p>
  </w:body>
</w:document>`);

  word?.folder("_rels")?.file("document.xml.rels", `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`);
  word?.file("styles.xml", `<?xml version="1.0" encoding="UTF-8"?>
<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"></w:styles>`);

  return zip.generateAsync({ type: "nodebuffer" });
}

async function buildOdtBuffer(text: string): Promise<Buffer> {
  const zip = new JSZip();

  zip.file("mimetype", "application/vnd.oasis.opendocument.text");
  zip.file("content.xml", `<?xml version="1.0" encoding="UTF-8"?>
<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0">
  <office:body><office:text><text:p>${text}</text:p></office:text></office:body>
</office:document-content>`);

  zip.folder("META-INF")?.file("manifest.xml", `<?xml version="1.0" encoding="UTF-8"?>
<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0">
  <manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text"/>
  <manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/>
</manifest:manifest>`);

  return zip.generateAsync({ type: "nodebuffer" });
}

test("extrai texto de arquivos simples", async () => {
  const file = buildMockFile({
    buffer: Buffer.from("Hello preview\nwith newline"),
    mimetype: "text/plain",
  });

  const preview = await extractTextPreview(file);
  assert.equal(preview, "Hello preview\nwith newline");
});

test("trata CSV como texto limpo", async () => {
  const file = buildMockFile({
    buffer: Buffer.from("col1,col2\nfoo,bar"),
    mimetype: "text/csv",
  });

  const preview = await extractTextPreview(file);
  assert.equal(preview, "col1 col2\nfoo bar");
});

test("extrai preview de PDF", async () => {
  const previousEngine = process.env.PDF_PREVIEW_ENGINE;
  delete process.env.PDF_PREVIEW_ENGINE;
  const file = buildMockFile({
    buffer: buildPdfBuffer("Hello PDF preview"),
    mimetype: "application/pdf",
  });

  const preview = await extractTextPreview(file);
  assert.ok(preview?.includes("Hello PDF preview"));

  if (previousEngine === undefined) delete process.env.PDF_PREVIEW_ENGINE;
  else process.env.PDF_PREVIEW_ENGINE = previousEngine;
});

test("PDF.js preserva colunas como tabela Markdown quando configurado", async () => {
  const previousEngine = process.env.PDF_PREVIEW_ENGINE;
  process.env.PDF_PREVIEW_ENGINE = "pdfjs";

  try {
    const file = buildMockFile({
      buffer: buildPdfTableBuffer([
        ["Composicao", "Dose"],
        ["Ingrediente ativo", "10g"],
        ["Veiculo", "q.s.p."],
      ]),
      mimetype: "application/pdf",
    });

    const preview = await extractTextPreview(file);
    assert.ok(preview?.includes("| Composicao | Dose |"));
    assert.ok(preview?.includes("| --- | --- |"));
  } finally {
    if (previousEngine === undefined) delete process.env.PDF_PREVIEW_ENGINE;
    else process.env.PDF_PREVIEW_ENGINE = previousEngine;
  }
});

test("pdf-parse não injeta pipes/tabela quando engine está configurada", async () => {
  const previousEngine = process.env.PDF_PREVIEW_ENGINE;
  process.env.PDF_PREVIEW_ENGINE = "pdf-parse";

  try {
    const file = buildMockFile({
      buffer: buildPdfTableBuffer([
        ["Composicao", "Dose"],
        ["Ingrediente ativo", "10g"],
        ["Veiculo", "q.s.p."],
      ]),
      mimetype: "application/pdf",
    });

    const preview = await extractTextPreview(file);
    assert.ok(preview?.includes("Composicao"));
    assert.ok(preview?.includes("Dose"));
    assert.ok(!preview?.includes("| --- | --- |"));
  } finally {
    if (previousEngine === undefined) delete process.env.PDF_PREVIEW_ENGINE;
    else process.env.PDF_PREVIEW_ENGINE = previousEngine;
  }
});

test("respeita PDF_PREVIEW_MAX_CHARS para PDFs", async () => {
  const prevEngine = process.env.PDF_PREVIEW_ENGINE;
  const prevMaxChars = process.env.PDF_PREVIEW_MAX_CHARS;

  process.env.PDF_PREVIEW_ENGINE = "pdfjs";
  process.env.PDF_PREVIEW_MAX_CHARS = "40";

  try {
    const file = buildMockFile({
      buffer: buildPdfTableBuffer([
        ["Composicao", "Dose"],
        ["Ingrediente ativo", "10g"],
        ["Veiculo", "q.s.p."],
      ]),
      mimetype: "application/pdf",
    });

    const preview = await extractTextPreview(file);
    assert.ok(preview);
    assert.ok(preview.length <= 40);
  } finally {
    if (prevEngine === undefined) delete process.env.PDF_PREVIEW_ENGINE;
    else process.env.PDF_PREVIEW_ENGINE = prevEngine;

    if (prevMaxChars === undefined) delete process.env.PDF_PREVIEW_MAX_CHARS;
    else process.env.PDF_PREVIEW_MAX_CHARS = prevMaxChars;
  }
});

test("extrai preview de DOCX", async () => {
  const file = buildMockFile({
    buffer: await buildDocxBuffer("Olá DOCX"),
    mimetype: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  });

  const preview = await extractTextPreview(file);
  assert.ok(preview?.includes("Olá DOCX"));
});

test("extrai preview de RTF", async () => {
  const file = buildMockFile({
    buffer: Buffer.from("{\\rtf1\\ansi\\deff0{\\fonttbl{\\f0 Arial;}}\\pard\\f0\\fs24 RTF content aqui\\par}"),
    mimetype: "application/rtf",
  });

  const preview = await extractTextPreview(file);
  assert.ok(preview?.includes("RTF content aqui"));
});

test("extrai preview de ODT", async () => {
  const file = buildMockFile({
    buffer: await buildOdtBuffer("Conteúdo ODT"),
    mimetype: "application/vnd.oasis.opendocument.text",
  });

  const preview = await extractTextPreview(file);
  assert.ok(preview?.includes("Conteúdo ODT"));
});

test("não trunca preview por padrão", async () => {
  const longText = "a".repeat(5000);
  const file = buildMockFile({
    buffer: Buffer.from(longText),
    mimetype: "text/plain",
  });

  const preview = await extractTextPreview(file);
  assert.equal(DEFAULT_MAX_PREVIEW_LENGTH, Number.POSITIVE_INFINITY);
  assert.equal(preview?.length, longText.length);
});

test("permite truncar quando limite customizado é informado", async () => {
  const longText = "b".repeat(3000);
  const file = buildMockFile({
    buffer: Buffer.from(longText),
    mimetype: "text/plain",
  });

  const preview = await extractTextPreview(file, 1000);
  assert.equal(preview?.length, 1000);
});

test("retorna undefined para MIME não suportado", async () => {
  const file = buildMockFile({
    buffer: Buffer.from("binary"),
    mimetype: "application/octet-stream",
  });

  const preview = await extractTextPreview(file);
  assert.equal(preview, undefined);
});

test("falha de parsing não quebra fluxo", async () => {
  const file = buildMockFile({
    buffer: Buffer.from("invalid"),
    mimetype: "application/msword",
  });

  const preview = await extractTextPreview(file);
  assert.equal(preview, undefined);
});
