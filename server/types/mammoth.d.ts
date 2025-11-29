declare module "mammoth" {
  interface MammothExtractResult {
    value: string;
    messages: Array<{ type: string; message: string }>;
  }

  export function extractRawText(input: { buffer: Buffer }): Promise<MammothExtractResult>;

  const mammoth: {
    extractRawText: typeof extractRawText;
  };

  export default mammoth;
}
