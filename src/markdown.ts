import DOMPurify from "dompurify";
import type { Config } from "dompurify";
import { marked } from "marked";

marked.setOptions({ gfm: true, breaks: false });

const PURIFY_CONFIG: Config = {
  USE_PROFILES: { html: true },
  FORBID_TAGS: ["style", "form", "svg", "base", "template"],
  FORBID_ATTR: ["srcdoc"],
  ADD_FORBID_CONTENTS: ["form"],
  ALLOW_UNKNOWN_PROTOCOLS: false,
};

function dropDataUriAttrs(
  _node: Element,
  event: { attrValue: string; keepAttr: boolean },
): void {
  if (/^\s*data:/i.test(event.attrValue)) {
    event.keepAttr = false;
  }
}

let dataUriHookBound = false;

function sanitize(html: string): string {
  if (!dataUriHookBound) {
    DOMPurify.addHook("uponSanitizeAttribute", dropDataUriAttrs);
    dataUriHookBound = true;
  }
  return DOMPurify.sanitize(html, PURIFY_CONFIG);
}

export function stripFrontmatter(text: string): string {
  return text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

export function toNiceHtml(raw: string, path: string): string {
  const body = stripFrontmatter(raw).trim();
  let md = body;
  if (path.endsWith(".json")) {
    try {
      md = `\`\`\`json\n${JSON.stringify(JSON.parse(body), null, 2)}\n\`\`\``;
    } catch {
      md = `\`\`\`\n${body}\n\`\`\``;
    }
  }
  const parsed = marked.parse(md, { async: false });
  return sanitize(typeof parsed === "string" ? parsed : "");
}
