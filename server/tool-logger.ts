// Centraliza o formato dos logs enviados ao terminal sobre o que a IA recebe.
type ToolLogPayload = {
  toolName: string;
  args: Record<string, unknown>;
  resultCount: number;
  aiPayload: string;
};

const PAYLOAD_PREVIEW_LIMIT = 800;

function cleanPayload(payload: string): string {
  return payload.replace(/\s+/g, " ").trim();
}

export function summarizeAiPayload(payload: string, limit = PAYLOAD_PREVIEW_LIMIT): {
  preview: string;
  truncated: boolean;
} {
  const normalized = cleanPayload(payload);

  if (normalized.length <= limit) {
    return {
      preview: normalized,
      truncated: false,
    };
  }

  return {
    preview: `${normalized.slice(0, limit)}…`,
    truncated: true,
  };
}

export function formatToolLogMessage(payload: ToolLogPayload): {
  label: string;
  args: Record<string, unknown>;
  resultCount: number;
  preview: string;
  truncated: boolean;
} {
  const { preview, truncated } = summarizeAiPayload(payload.aiPayload);

  return {
    label: `🧠 [AI CONTEXTO] Conteúdo entregue à IA via ${payload.toolName}`,
    args: payload.args,
    resultCount: payload.resultCount,
    preview,
    truncated,
  };
}

export function logToolPayload(payload: ToolLogPayload): void {
  const summary = formatToolLogMessage(payload);

  console.log("\n" + summary.label);
  console.log("   Argumentos:", JSON.stringify(summary.args));
  console.log(`   Resultados retornados: ${summary.resultCount}`);
  console.log("   Trecho enviado para a IA:", summary.preview);

  if (summary.truncated) {
    console.log(`   (preview truncado para ${PAYLOAD_PREVIEW_LIMIT} caracteres)`);
  }
}
