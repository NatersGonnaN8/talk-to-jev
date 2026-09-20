import { MAX_CONVERT_BYTES, convertFormatOf, miB } from "./formats";
import { htmlToMarkdown } from "./html";

export type ConvertProgress = {
  ratio: number;
  label: string;
};

export async function fileToMarkdown(
  file: File,
  onProgress?: (p: ConvertProgress) => void,
): Promise<string> {
  const format = convertFormatOf(file);
  if (!format) {
    throw new Error(`Cannot convert ${file.name || "this file"}.`);
  }
  if (format === "doc") {
    throw new Error("Save as .docx — this browser cannot read legacy Word .doc.");
  }
  if (file.size > MAX_CONVERT_BYTES) {
    throw new Error(`Too large: ${file.name} (max ${miB(MAX_CONVERT_BYTES)})`);
  }

  onProgress?.({ ratio: 0.08, label: "Reading" });
  if (format === "txt") {
    const text = (await file.text()).replace(/^\uFEFF/, "").trim();
    if (!text) throw new Error("That text file was empty.");
    onProgress?.({ ratio: 1, label: "Done" });
    return text;
  }

  if (format === "html") {
    const html = await file.text();
    const md = htmlToMarkdown(html);
    if (!md) throw new Error("That HTML file had no text to convert.");
    onProgress?.({ ratio: 1, label: "Done" });
    return md;
  }

  const buffer = await file.arrayBuffer();
  onProgress?.({ ratio: 0.2, label: "Converting" });

  if (format === "docx") {
    const { docxToMarkdown } = await import("./docx");
    const md = await docxToMarkdown(buffer);
    onProgress?.({ ratio: 1, label: "Done" });
    return md;
  }

  const { pdfToMarkdown } = await import("./pdf");
  const md = await pdfToMarkdown(buffer, (page, total) => {
    const ratio = 0.2 + (page / Math.max(1, total)) * 0.8;
    onProgress?.({
      ratio,
      label: `Page ${page} of ${total}`,
    });
  });
  onProgress?.({ ratio: 1, label: "Done" });
  return md;
}
