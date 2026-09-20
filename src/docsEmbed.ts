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

/** Live sources / origins that will not embed. Never store keys. */
export const DOCS_EMBED_BLOCK_KEY = "talk-to-jev:docs-embed-block";

export type EmbedBlockPrefs = {
  v: 1;
  urls: string[];
  origins: string[];
};

const EMPTY_BLOCKS: EmbedBlockPrefs = { v: 1, urls: [], origins: [] };
const MAX_BLOCK_URLS = 200;
const MAX_BLOCK_ORIGINS = 80;

function uniqueStrings(items: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const item of items) {
    if (!item || seen.has(item)) continue;
    seen.add(item);
    out.push(item);
  }
  return out;
}

function httpsOrigin(src: string): string | null {
  try {
    const url = new URL(src);
    if (url.protocol !== "https:") return null;
    if (looksLikeSecret(url)) return null;
    return url.origin;
  } catch {
    return null;
  }
}

export function loadEmbedBlocks(): EmbedBlockPrefs {
  try {
    const raw = localStorage.getItem(DOCS_EMBED_BLOCK_KEY);
    if (!raw) return EMPTY_BLOCKS;
    const parsed = JSON.parse(raw) as Partial<EmbedBlockPrefs>;
    const urls = Array.isArray(parsed.urls)
      ? uniqueStrings(
          parsed.urls.filter(
            (u): u is string =>
              typeof u === "string" && u.startsWith("https:") && !KEY_SHAPED.test(u),
          ),
        ).slice(0, MAX_BLOCK_URLS)
      : [];
    const origins = Array.isArray(parsed.origins)
      ? uniqueStrings(
          parsed.origins.filter(
            (o): o is string =>
              typeof o === "string" && o.startsWith("https:") && !KEY_SHAPED.test(o),
          ),
        ).slice(0, MAX_BLOCK_ORIGINS)
      : [];
    return { v: 1, urls, origins };
  } catch {
    return EMPTY_BLOCKS;
  }
}

function saveEmbedBlocks(prefs: EmbedBlockPrefs): void {
  try {
    localStorage.setItem(
      DOCS_EMBED_BLOCK_KEY,
      JSON.stringify({
        v: 1,
        urls: prefs.urls.slice(0, MAX_BLOCK_URLS),
        origins: prefs.origins.slice(0, MAX_BLOCK_ORIGINS),
      }),
    );
  } catch {
    /* quota — hide still works this session via memory */
  }
}

export function embedIsBlocked(src: string, prefs: EmbedBlockPrefs): boolean {
  if (!src) return false;
  if (prefs.urls.includes(src)) return true;
  const origin = httpsOrigin(src);
  return origin ? prefs.origins.includes(origin) : false;
}

export function rememberEmbedBlock(
  src: string,
  prefs: EmbedBlockPrefs,
): EmbedBlockPrefs {
  if (!src.startsWith("https:") || KEY_SHAPED.test(src)) return prefs;
  const origin = httpsOrigin(src);
  const next: EmbedBlockPrefs = {
    v: 1,
    urls: uniqueStrings([src, ...prefs.urls]).slice(0, MAX_BLOCK_URLS),
    origins: origin
      ? uniqueStrings([origin, ...prefs.origins]).slice(0, MAX_BLOCK_ORIGINS)
      : prefs.origins,
  };
  saveEmbedBlocks(next);
  return next;
}
