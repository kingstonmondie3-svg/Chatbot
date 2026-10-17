import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";

export async function extractText(
  buffer: Buffer,
  mime: string,
): Promise<string | null> {
  try {
    // Images: no text extraction
    if (mime.startsWith("image/")) return null;

    // PDF
    if (mime === "application/pdf") {
      const parser = new PDFParse({ data: new Uint8Array(buffer) });
      try {
        const result = await parser.getText();
        return result.text.trim() || null;
      } finally {
        await parser.destroy();
      }
    }

    // DOCX
    if (
      mime ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ) {
      const result = await mammoth.extractRawText({ buffer });
      return result.value.trim() || null;
    }

    // CSV
    if (mime === "text/csv") {
      return buffer.toString("utf-8").trim() || null;
    }

    // Plain text and code files
    if (mime.startsWith("text/")) {
      return buffer.toString("utf-8").trim() || null;
    }

    // JSON
    if (mime === "application/json") {
      return buffer.toString("utf-8").trim() || null;
    }

    return null;
  } catch {
    return null;
  }
}
