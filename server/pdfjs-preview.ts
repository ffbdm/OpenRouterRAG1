export type PdfPreviewEngine = "pdf-parse" | "pdfjs" | "pdfjs+fallback";

export type PdfJsPreviewOptions = {
  maxPages?: number;
  maxChars?: number;
  timeoutMs?: number;
  minTableRows?: number;
  lineYThreshold?: number;
  columnGapRatio?: number;
};

export type PdfJsPreviewResult = {
  text: string | undefined;
  pagesProcessed: number;
  outputChars: number;
  durationMs: number;
  usedMarkdownTable: boolean;
};

type PositionedTextItem = {
  text: string;
  x: number;
  y: number;
  width: number;
  fontSize: number;
};

type Line = {
  y: number;
  items: PositionedTextItem[];
};

function median(values: number[]): number | undefined {
  const clean = values.filter((value) => Number.isFinite(value)).sort((a, b) => a - b);
  if (clean.length === 0) return undefined;
  const mid = Math.floor(clean.length / 2);
  return clean.length % 2 === 0 ? (clean[mid - 1] + clean[mid]) / 2 : clean[mid];
}

async function runWithTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number | undefined,
  onTimeout?: () => Promise<void> | void,
): Promise<T> {
  const resolvedTimeoutMs = typeof timeoutMs === "number" && Number.isFinite(timeoutMs) && timeoutMs > 0 ? timeoutMs : undefined;
  if (!resolvedTimeoutMs) return promise;

  let timer: NodeJS.Timeout | undefined;
  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(async () => {
          try {
            await onTimeout?.();
          } finally {
            reject(new Error(`[PDFJS] Timeout após ${resolvedTimeoutMs}ms`));
          }
        }, resolvedTimeoutMs);
      }),
    ]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function groupItemsIntoLines(items: PositionedTextItem[], yThreshold: number): Line[] {
  const sorted = items
    .slice()
    .sort((a, b) => (b.y - a.y) || (a.x - b.x));

  const lines: Line[] = [];
  for (const item of sorted) {
    const current = lines.at(-1);
    if (!current || Math.abs(item.y - current.y) > yThreshold) {
      lines.push({ y: item.y, items: [item] });
    } else {
      current.items.push(item);
      current.y = (current.y + item.y) / 2;
    }
  }

  for (const line of lines) {
    line.items.sort((a, b) => a.x - b.x);
  }

  return lines;
}

function splitLineIntoCells(line: Line, options: { gapThreshold: number }): string[] {
  const cells: string[] = [];
  let current = "";

  const push = () => {
    const trimmed = current.trim();
    if (trimmed) cells.push(trimmed);
    current = "";
  };

  for (const [index, item] of line.items.entries()) {
    const normalized = item.text.replace(/\s+/g, " ").trim();
    if (!normalized) continue;

    if (index === 0) {
      current = normalized;
      continue;
    }

    const prev = line.items[index - 1];
    const gap = item.x - (prev.x + prev.width);
    if (gap > options.gapThreshold) {
      push();
      current = normalized;
      continue;
    }

    const needsSpace = current && !current.endsWith("-") && !current.endsWith("/") && !current.endsWith("(");
    current = current ? `${current}${needsSpace ? " " : ""}${normalized}` : normalized;
  }

  push();
  return cells;
}

function escapeMarkdownCell(value: string): string {
  return value.replace(/\|/g, "\\|").trim();
}

function renderMarkdownRow(cells: string[], wrap: boolean): string {
  const content = cells.map(escapeMarkdownCell).join(" | ");
  return wrap ? `| ${content} |` : content;
}

function renderMarkdownTable(rows: string[][]): string[] {
  if (rows.length === 0) return [];
  const header = rows[0];
  const cols = header.length;
  const separator = Array.from({ length: cols }, () => "---");
  const rendered: string[] = [];
  rendered.push(renderMarkdownRow(header, true));
  rendered.push(renderMarkdownRow(separator, true));
  for (const row of rows.slice(1)) {
    rendered.push(renderMarkdownRow(row, true));
  }
  return rendered;
}

function detectAndRenderTables(lines: Line[], options: Required<Pick<PdfJsPreviewOptions, "minTableRows">> & { gapThreshold: number }): string[] {
  const lineCells = lines.map((line) => splitLineIntoCells(line, { gapThreshold: options.gapThreshold }));

  const output: string[] = [];
  let index = 0;

  while (index < lineCells.length) {
    if (lineCells[index].length < 2) {
      output.push(renderMarkdownRow(lineCells[index], false));
      index += 1;
      continue;
    }

    const start = index;
    while (index < lineCells.length && lineCells[index].length >= 2) index += 1;
    const block = lineCells.slice(start, index);

    const counts = block.map((cells) => cells.length);
    const mode = counts
      .reduce((acc, count) => {
        acc.set(count, (acc.get(count) ?? 0) + 1);
        return acc;
      }, new Map<number, number>());

    let bestCount = 0;
    let bestFrequency = 0;
    for (const [count, frequency] of mode.entries()) {
      if (count >= 2 && frequency > bestFrequency) {
        bestCount = count;
        bestFrequency = frequency;
      }
    }

    const stableRows = block.filter((cells) => cells.length === bestCount);
    if (bestCount >= 2 && stableRows.length >= options.minTableRows) {
      output.push(...renderMarkdownTable(stableRows));
    } else {
      for (const row of block) {
        output.push(row.length >= 2 ? row.map(escapeMarkdownCell).join(" | ") : renderMarkdownRow(row, false));
      }
    }
  }

  return output.filter((line) => line.trim());
}

export async function extractPdfPreviewWithPdfJsWithStats(buffer: Buffer, options?: PdfJsPreviewOptions): Promise<PdfJsPreviewResult> {
  const startMs = Date.now();
  const resolvedMaxPages = typeof options?.maxPages === "number" && options.maxPages > 0 ? Math.floor(options.maxPages) : undefined;
  const resolvedMaxChars = typeof options?.maxChars === "number" && options.maxChars > 0 ? Math.floor(options.maxChars) : undefined;

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const loadingTask = pdfjs.getDocument({
    data: new Uint8Array(buffer),
    verbosity: pdfjs.VerbosityLevel.ERRORS,
  });

  const parsePromise = (async () => {
    const doc = await loadingTask.promise;
    try {
      const totalPages = doc.numPages;
      const pageLimit = resolvedMaxPages ? Math.min(resolvedMaxPages, totalPages) : totalPages;

      const outputLines: string[] = [];
      let outputLength = 0;
      let pagesProcessed = 0;
      let usedMarkdownTable = false;

      const pushLine = (line: string) => {
        outputLines.push(line);
        outputLength += line.length + 1;
      };

      for (let pageNumber = 1; pageNumber <= pageLimit; pageNumber += 1) {
        const page = await doc.getPage(pageNumber);
        const textContent = await page.getTextContent();
        pagesProcessed += 1;

        const items: PositionedTextItem[] = [];
        for (const raw of textContent.items as Array<Record<string, unknown>>) {
          const text = typeof raw.str === "string" ? raw.str : "";
          const transform = Array.isArray(raw.transform) ? (raw.transform as number[]) : undefined;
          if (!text.trim() || !transform || transform.length < 6) continue;

          const x = Number(transform[4]);
          const y = Number(transform[5]);
          const width = typeof raw.width === "number" ? raw.width : 0;
          const fontSizeCandidate = Math.max(Math.abs(Number(transform[0])), Math.abs(Number(transform[3])));
          const fontSize = Number.isFinite(fontSizeCandidate) && fontSizeCandidate > 0 ? fontSizeCandidate : 10;

          if (!Number.isFinite(x) || !Number.isFinite(y)) continue;

          items.push({
            text,
            x,
            y,
            width: Number.isFinite(width) && width >= 0 ? width : 0,
            fontSize,
          });
        }

        if (items.length === 0) continue;

        const medianFontSize = median(items.map((item) => item.fontSize)) ?? 10;
        const yThreshold = options?.lineYThreshold ?? Math.max(2, medianFontSize * 0.35);
        const gapThreshold = Math.max(8, medianFontSize * (options?.columnGapRatio ?? 1.6));
        const minTableRows = options?.minTableRows ?? 3;

        const lines = groupItemsIntoLines(items, yThreshold);
        const renderedLines = detectAndRenderTables(lines, { minTableRows, gapThreshold });

        for (const line of renderedLines) {
          if (!line.trim()) continue;
          pushLine(line);
          if (!usedMarkdownTable && line.startsWith("| ") && line.includes("| ---")) usedMarkdownTable = true;
          if (resolvedMaxChars && outputLength >= resolvedMaxChars) break;
        }

        if (resolvedMaxChars && outputLength >= resolvedMaxChars) break;

        if (pageNumber < pageLimit) pushLine("");
      }

      const combined = outputLines.join("\n").trim();
      const text = combined ? (resolvedMaxChars ? combined.slice(0, resolvedMaxChars) : combined) : undefined;
      const durationMs = Date.now() - startMs;
      return {
        text,
        pagesProcessed,
        outputChars: text?.length ?? 0,
        durationMs,
        usedMarkdownTable,
      };
    } finally {
      await doc.destroy();
    }
  })();

  return runWithTimeout(parsePromise, options?.timeoutMs, async () => {
    try {
      await loadingTask.destroy();
    } catch {
      // ignore
    }
  });
}

export async function extractPdfPreviewWithPdfJs(buffer: Buffer, options?: PdfJsPreviewOptions): Promise<string | undefined> {
  const result = await extractPdfPreviewWithPdfJsWithStats(buffer, options);
  return result.text;
}
