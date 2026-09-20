/** Docs reader view + live-source iframe. Storage: `talk-to-jev:docs-view`. Never store keys. */

export const DOCS_VIEW_KEY = "talk-to-jev:docs-view";

export type DocsView = "nice" | "code" | "iframe";

export type EmbedDecision =
  | { ok: true; src: string }
  | { ok: false; reason: string };

const KEY_SHAPED =
  /sk-or-|sk-ant-|sk-proj-|tvly-|BSA[A-Z0-9]|ghp_|github_pat_|AKIA/;

const LOCAL_BASENAMES = new Set(["primer.md", "index.md", "manifest.json"]);

function basename(path: string): string {
  const parts = path.replace(/\\/g, "/").split("/").filter(Boolean);
  return (parts[parts.length - 1] || "").toLowerCase();
}

export function isLocalSnapshotPage(path: string): boolean {
  const base = basename(path);
  if (LOCAL_BASENAMES.has(base)) return true;
  return base.startsWith("readme.");
}

function localReason(path: string): string {
  const base = basename(path);
  if (base === "primer.md") return "Local primer — no live page";
  if (base === "index.md") return "Local index — no live page";
  if (base === "manifest.json") return "Local manifest — no live page";
  if (base.startsWith("readme.")) return "Local snapshot — no live page";
  return "Local snapshot — no live page";
}

export function sourceFromHeader(text: string): string {
  const m = text.slice(0, 1200).match(/^source:\s*(.+)$/m);
  return m ? m[1].trim() : "";
}

function looksLikeSecret(url: URL): boolean {
  if (KEY_SHAPED.test(url.href)) return true;
  for (const [k, v] of url.searchParams) {
    if (!v) continue;
    if (/^(api[_-]?key|key|token|secret|password|auth)$/i.test(k)) return true;
  }
  return false;
}

/** https live page for the iframe, or a short disable reason. */
export function embedForDoc(path: string, source: string): EmbedDecision {
  if (isLocalSnapshotPage(path)) {
    return { ok: false, reason: localReason(path) };
  }
  const raw = source.trim();
  if (!raw) return { ok: false, reason: "No source URL" };
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return { ok: false, reason: "No live page" };
  }
  if (url.protocol === "http:") {
    return { ok: false, reason: "https only" };
  }
  if (url.protocol !== "https:") {
    return { ok: false, reason: "No live page" };
  }
  if (looksLikeSecret(url)) {
    return { ok: false, reason: "No live page" };
  }
  // Snapshot fetch URLs often end in .md; the live HTML page drops that suffix.
  if (url.pathname.toLowerCase().endsWith(".md")) {
    url.pathname = url.pathname.slice(0, -3);
  }
  return { ok: true, src: url.toString() };
}

export function loadDocsView(): DocsView {
  try {
    const v = localStorage.getItem(DOCS_VIEW_KEY);
    if (v === "code" || v === "iframe" || v === "nice") return v;
  } catch {
    /* private mode */
  }
  return "nice";
}

export function saveDocsView(view: DocsView): void {
  try {
    localStorage.setItem(DOCS_VIEW_KEY, view);
  } catch {
    /* quota — reader still works this session */
  }
}
