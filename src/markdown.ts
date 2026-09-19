import { marked } from "marked";

marked.setOptions({ gfm: true, breaks: false });

export function stripFrontmatter(text: string): string {
  return text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, "");
}

function sanitize(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script,iframe,object,embed,link,meta").forEach((n) => n.remove());
  for (const el of doc.body.querySelectorAll("*")) {
    for (const attr of [...el.attributes]) {
      const href = attr.name === "href" || attr.name === "src";
      if (
        attr.name.startsWith("on") ||
        (href && /^\s*javascript:/i.test(attr.value))
      ) {
        el.removeAttribute(attr.name);
      }
    }
  }
  return doc.body.innerHTML;
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
