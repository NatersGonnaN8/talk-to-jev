/** Local .md → Jev’s State ticket (Jev `state`). Browser File objects only.
 * Never reads `.env`. Never uploads. Never writes user files to disk.
 */

export const MAX_ATTACH_CHARS = 200_000;
export const MAX_ATTACH_BYTES = 256 * 1024;
export const MAX_ATTACH_FILES = 12;

const MAX_NAME = 180;

export function escapeRegExp(s: string) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function sanitizeAttachName(raw: string): string {
  const base = raw.replace(/\\/g, "/").split("/").pop() ?? "";
  let name = base
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .replace(/-->/g, "->")
    .replace(/--/g, "-")
    .replace(/[<>]/g, "")
    .trim();
  if (!name) name = "untitled.md";
  if (!/\.(md|markdown)$/i.test(name)) name = `${name}.md`;
  if (name.length > MAX_NAME) {
    const ext = name.toLowerCase().endsWith(".markdown") ? ".markdown" : ".md";
    name = `${name.slice(0, Math.max(1, MAX_NAME - ext.length))}${ext}`;
  }
  return name;
}

export function isMarkdownFile(file: { name: string; type?: string }): boolean {
  const name = file.name.toLowerCase();
  if (name.endsWith(".md") || name.endsWith(".markdown")) return true;
  const type = (file.type ?? "").toLowerCase();
  return type === "text/markdown" || type === "text/x-markdown";
}

export function attachBlock(name: string, inner: string): string {
  const safe = sanitizeAttachName(name);
  const body = inner.replace(/\s+$/, "");
  return `<!-- attach:start ${safe} -->\n${body}\n<!-- attach:end ${safe} -->`;
}

function attachBlockRe(name: string): RegExp {
  const n = escapeRegExp(sanitizeAttachName(name));
  return new RegExp(
    `<!-- attach:start ${n} -->[\\s\\S]*?<!-- attach:end ${n} -->\\n?`,
  );
}

export function listAttachedNames(caseText: string): string[] {
  const names: string[] = [];
  const re = /<!-- attach:start (.+?) -->/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(caseText))) {
    const name = m[1].trim();
    if (name && !names.includes(name)) names.push(name);
  }
  return names;
}

export function mergeAttachIntoCase(
  caseText: string,
  filename: string,
  inner: string,
): string {
  const block = attachBlock(filename, inner);
  const re = attachBlockRe(filename);
  if (re.test(caseText)) return caseText.replace(re, block);
  const trimmed = caseText.replace(/\s+$/, "");
  return trimmed ? `${trimmed}\n\n${block}\n` : `${block}\n`;
}

export function stripAttachFromCase(caseText: string, filename: string): string {
  const next = caseText.replace(attachBlockRe(filename), "");
  return next.replace(/\n{3,}/g, "\n\n").replace(/[ \t]+\n/g, "\n");
}

export type AttachResult = {
  state: string;
  added: string[];
  errors: string[];
};

function kiB(n: number) {
  return `${Math.round(n / 1024)} KiB`;
}

export async function attachFilesToCase(
  caseText: string,
  files: Iterable<File>,
): Promise<AttachResult> {
  let state = caseText;
  const added: string[] = [];
  const errors: string[] = [];

  for (const file of files) {
    const label = file.name?.trim() || "file";
    if (!isMarkdownFile(file)) {
      errors.push(`Not markdown: ${label}`);
      continue;
    }
    if (file.size > MAX_ATTACH_BYTES) {
      errors.push(`Too large: ${label} (max ${kiB(MAX_ATTACH_BYTES)})`);
      continue;
    }
    let text: string;
    try {
      text = await file.text();
    } catch {
      errors.push(`Could not read ${label}`);
      continue;
    }
    if (text.length > MAX_ATTACH_CHARS) {
      errors.push(
        `Too large: ${label} (max ${MAX_ATTACH_CHARS.toLocaleString()} characters)`,
      );
      continue;
    }
    const name = sanitizeAttachName(file.name);
    const already = listAttachedNames(state);
    const replacing = already.includes(name);
    if (!replacing && already.length >= MAX_ATTACH_FILES) {
      errors.push(`At most ${MAX_ATTACH_FILES} attached files`);
      continue;
    }
    state = mergeAttachIntoCase(state, name, text);
    added.push(name);
  }

  return { state, added, errors };
}
