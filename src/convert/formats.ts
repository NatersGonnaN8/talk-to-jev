import { isMarkdownFile } from "../attach";

export const MAX_CONVERT_BYTES = 12 * 1024 * 1024;
export const MAX_CONVERT_BATCH = 8;

export const MARKDOWN_ACCEPT = ".md,.markdown,text/markdown";
export const CONVERT_ACCEPT =
  ".txt,.html,.htm,.docx,.pdf,.doc,text/plain,text/html,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/msword";

export type ConvertFormat = "txt" | "html" | "docx" | "pdf" | "doc";
export type DropKind = "markdown" | "convert" | "unsupported";

export function extOf(name: string): string {
  const n = name.toLowerCase();
  const i = n.lastIndexOf(".");
  return i >= 0 ? n.slice(i) : "";
}

export function convertFormatOf(file: { name: string; type?: string }): ConvertFormat | null {
  const ext = extOf(file.name);
  const type = (file.type ?? "").toLowerCase();
  if (ext === ".txt" || type === "text/plain") return "txt";
  if (ext === ".html" || ext === ".htm" || type === "text/html") return "html";
  if (
    ext === ".docx" ||
    type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    return "docx";
  }
  if (ext === ".pdf" || type === "application/pdf") return "pdf";
  if (ext === ".doc" || type === "application/msword") return "doc";
  return null;
}

export function classifyDrop(file: { name: string; type?: string }): DropKind {
  if (isMarkdownFile(file)) return "markdown";
  if (convertFormatOf(file)) return "convert";
  return "unsupported";
}

export function partitionDroppedFiles(files: Iterable<File>): {
  markdown: File[];
  convert: File[];
  unsupported: string[];
} {
  const markdown: File[] = [];
  const convert: File[] = [];
  const unsupported: string[] = [];
  for (const file of files) {
    const kind = classifyDrop(file);
    if (kind === "markdown") markdown.push(file);
    else if (kind === "convert") convert.push(file);
    else unsupported.push(file.name?.trim() || "file");
  }
  return { markdown, convert, unsupported };
}

export function markdownNameFrom(filename: string): string {
  const base = filename.replace(/\\/g, "/").split("/").pop() ?? "file";
  const stem = base.replace(/\.[^.]+$/, "") || "file";
  return `${stem}.md`;
}

export function kiB(n: number) {
  return `${Math.round(n / 1024)} KiB`;
}

export function miB(n: number) {
  return `${Math.round(n / (1024 * 1024))} MiB`;
}
