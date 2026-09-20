/** HEAD/GET a catalog https source to see if it will embed. No keys. */

export type CatalogSource = { path: string; source: string };

export type EmbedProbe = {
  embed: boolean;
  src: string;
};

const PRIVATE_HOST =
  /^(localhost|127\.0\.0\.1|0\.0\.0\.0|::1|\[::1\])$|^(10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[0-1])\.)/i;

function isPrivateHost(hostname: string): boolean {
  const host = hostname.trim().replace(/^\[|\]$/g, "").toLowerCase();
  return PRIVATE_HOST.test(host);
}

function liveSrcFromSource(source: string): string | null {
  const raw = source.trim();
  if (!raw) return null;
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  if (isPrivateHost(url.hostname)) return null;
  if (url.pathname.toLowerCase().endsWith(".md")) {
    url.pathname = url.pathname.slice(0, -3);
  }
  return url.toString();
}

function catalogLiveUrls(files: CatalogSource[]): Set<string> {
  const out = new Set<string>();
  for (const f of files) {
    const live = liveSrcFromSource(f.source);
    if (live) out.add(live);
    const raw = f.source.trim();
    try {
      const u = new URL(raw);
      if (u.protocol === "https:" && !isPrivateHost(u.hostname)) out.add(u.toString());
    } catch {
      /* skip */
    }
  }
  return out;
}

/** Parse X-Frame-Options + CSP frame-ancestors. SAMEORIGIN/self are the remote site, not us. */
export function headersAllowIframe(
  xfo: string | null,
  csp: string | null,
): boolean {
  if (xfo) {
    const v = xfo.trim().toUpperCase();
    if (v === "DENY" || v === "SAMEORIGIN") return false;
    if (v.startsWith("ALLOW-FROM")) return false;
  }
  if (!csp) return true;
  const m = csp.match(/frame-ancestors\s+([^;]+)/i);
  if (!m) return true;
  const tokens = m[1]
    .trim()
    .split(/\s+/)
    .map((t) => t.replace(/^['"]|['"]$/g, "").toLowerCase());
  if (tokens.includes("'none'") || tokens.includes("none")) return false;
  if (tokens.includes("*")) return true;
  // 'self' is the docs host, not 127.0.0.1:5182
  return false;
}

async function readEmbedHeaders(src: string): Promise<{
  xfo: string | null;
  csp: string | null;
}> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 8000);
  const init: RequestInit = {
    redirect: "manual",
    signal: ctrl.signal,
    headers: { Accept: "text/html,application/xhtml+xml" },
  };
  try {
    let res = await fetch(src, { ...init, method: "HEAD" });
    if (res.status === 405 || res.status === 501) {
      res = await fetch(src, { ...init, method: "GET" });
    }
    let hops = 0;
    while (res.status >= 300 && res.status < 400 && hops < 4) {
      const loc = res.headers.get("location");
      if (!loc) break;
      const next = new URL(loc, src);
      if (next.protocol !== "https:" || isPrivateHost(next.hostname)) {
        return { xfo: "DENY", csp: null };
      }
      hops += 1;
      res = await fetch(next.toString(), { ...init, method: "HEAD" });
      if (res.status === 405 || res.status === 501) {
        res = await fetch(next.toString(), { ...init, method: "GET" });
      }
    }
    const headers = {
      xfo: res.headers.get("x-frame-options"),
      csp: res.headers.get("content-security-policy"),
    };
    if (res.body) void res.body.cancel();
    return headers;
  } finally {
    clearTimeout(timer);
  }
}

export async function checkCatalogEmbed(
  requested: string,
  files: CatalogSource[],
): Promise<EmbedProbe> {
  let url: URL;
  try {
    url = new URL(requested.trim());
  } catch {
    return { embed: false, src: "" };
  }
  if (url.protocol !== "https:" || isPrivateHost(url.hostname)) {
    return { embed: false, src: url.toString() };
  }
  const src = url.toString();
  if (!catalogLiveUrls(files).has(src)) {
    return { embed: false, src };
  }
  try {
    const { xfo, csp } = await readEmbedHeaders(src);
    return { embed: headersAllowIframe(xfo, csp), src };
  } catch {
    // Probe failed — let the iframe try; the pane still has the fallback path.
    return { embed: true, src };
  }
}
