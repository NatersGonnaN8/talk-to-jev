/** Docs rail sort + type tags. Storage: `talk-to-jev:docs-rail`. Never store keys. */

export const DOCS_RAIL_KEY = "talk-to-jev:docs-rail";

export type DocsSort = "asc" | "desc";

export type DocsRailPrefs = {
  v: 1;
  sort: DocsSort;
  tags: string[];
  collapsed: boolean;
};

export type DocListItem = {
  path: string;
  title: string;
  source: string;
  fetchedAt: string;
};

const SNAPSHOT_BASENAMES = new Set(["index.md", "readme.md", "manifest.json"]);

function uniqueTags(tags: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const tag of tags) {
    if (!tag || seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out;
}

/** Stable type id from the snapshot path. No second catalog. */
export function docType(path: string): string {
  const norm = path.replace(/\\/g, "/").replace(/^\/+/, "");
  const parts = norm.split("/").filter(Boolean);
  if (parts.length === 0) return "snapshot";
  const base = parts[parts.length - 1].toLowerCase();
  if (parts.length === 1) {
    if (base === "primer.md") return "primer";
    if (SNAPSHOT_BASENAMES.has(base) || base.startsWith("readme.")) {
      return "snapshot";
    }
  }
  if (parts.includes("cookbooks")) return "cookbook";
  if (parts.includes("sdk") || base === "sdk.md") return "sdk";
  return parts[0].toLowerCase();
}

export function compareDocs(
  a: { title: string; path: string },
  b: { title: string; path: string },
  sort: DocsSort,
): number {
  const titles = a.title.localeCompare(b.title, undefined, { sensitivity: "base" });
  const cmp = titles !== 0 ? titles : a.path.localeCompare(b.path);
  return sort === "asc" ? cmp : -cmp;
}

export function docMatchesSearch(file: DocListItem, q: string): boolean {
  const needle = q.trim().toLowerCase();
  if (!needle) return true;
  const hay = `${file.path} ${file.title} ${file.source}`.toLowerCase();
  return hay.includes(needle);
}

export function docMatchesTags(type: string, tags: string[]): boolean {
  if (tags.length === 0) return true;
  return tags.includes(type);
}

export function loadDocsRailPrefs(): DocsRailPrefs {
  const fallback: DocsRailPrefs = { v: 1, sort: "asc", tags: [], collapsed: false };
  try {
    const raw = localStorage.getItem(DOCS_RAIL_KEY);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw) as Partial<DocsRailPrefs>;
    const sort: DocsSort = parsed.sort === "desc" ? "desc" : "asc";
    const tags = Array.isArray(parsed.tags)
      ? uniqueTags(
          parsed.tags.filter((t): t is string => typeof t === "string" && t.length > 0),
        )
      : [];
    return { v: 1, sort, tags, collapsed: parsed.collapsed === true };
  } catch {
    return fallback;
  }
}

export function saveDocsRailPrefs(prefs: DocsRailPrefs): void {
  try {
    localStorage.setItem(
      DOCS_RAIL_KEY,
      JSON.stringify({
        v: 1,
        sort: prefs.sort,
        tags: uniqueTags(prefs.tags),
        collapsed: prefs.collapsed === true,
      }),
    );
  } catch {
    /* quota — rail still works this session */
  }
}
