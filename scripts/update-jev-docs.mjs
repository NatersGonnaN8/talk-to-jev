#!/usr/bin/env node
/**
 * Snapshot official Jev / System One docs into docs/jev/.
 * Used by `npm run update-jev-docs` and POST /api/docs/update.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const here = dirname(fileURLToPath(import.meta.url));
const defaultRoot = resolve(here, "..");
const LLMS = "https://docs.typesafe.ai/llms.txt";
const PRIMER_CAP = 48_000;
const CONCURRENCY = 5;

function isoNow() {
  return new Date().toISOString();
}

function loadCatalog(root) {
  const raw = readFileSync(join(root, "scripts", "jev-docs-catalog.json"), "utf8");
  return JSON.parse(raw);
}

function htmlToMarkdown(html, url) {
  let text = String(html);
  text = text.replace(/<script[\s\S]*?<\/script>/gi, "");
  text = text.replace(/<style[\s\S]*?<\/style>/gi, "");
  text = text.replace(/<nav[\s\S]*?<\/nav>/gi, "");
  text = text.replace(/<!--[\s\S]*?-->/g, "");
  text = text.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n# $1\n");
  text = text.replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n## $1\n");
  text = text.replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n### $1\n");
  text = text.replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, "\n#### $1\n");
  text = text.replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, "\n```\n$1\n```\n");
  text = text.replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`");
  text = text.replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "- $1\n");
  text = text.replace(/<br\s*\/?>/gi, "\n");
  text = text.replace(/<\/p>/gi, "\n\n");
  text = text.replace(/<\/tr>/gi, "\n");
  text = text.replace(/<\/(div|section|article|header|footer|td|th)>/gi, "\n");
  text = text.replace(/<[^>]+>/g, "");
  text = text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'");
  text = text.replace(/[ \t]+\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  return `# Source\n\n${url}\n\n${text}\n`;
}

function wrapMarkdown(body, url, fetchedAt) {
  const trimmed = String(body).replace(/\r\n/g, "\n").trim();
  return `---\nsource: ${url}\nfetched_at: ${fetchedAt}\n---\n\n${trimmed}\n`;
}

function typesafeRelPath(url) {
  const u = new URL(url);
  let p = u.pathname.replace(/^\//, "");
  if (!p.endsWith(".md")) p += ".md";
  return `typesafe/${p}`;
}

function parseLlmsTxt(text) {
  const items = [];
  const re = /\[([^\]]+)\]\((https:\/\/docs\.typesafe\.ai\/[^)]+)\)/g;
  let m;
  while ((m = re.exec(text))) {
    items.push({ title: m[1], url: m[2] });
  }
  return items;
}

async function mapPool(items, limit, fn) {
  const out = new Array(items.length);
  let i = 0;
  async function worker() {
    while (i < items.length) {
      const idx = i++;
      out[idx] = await fn(items[idx], idx);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return out;
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
    },
    redirect: "follow",
  });
  const body = await res.text();
  const type = res.headers.get("content-type") || "";
  return { ok: res.ok, status: res.status, body, type, finalUrl: res.url || url };
}

function toMarkdown(url, body, type) {
  if (type.includes("json") || (/^\s*[{\[]/.test(body) && url.includes("/api/"))) {
    try {
      return `\`\`\`json\n${JSON.stringify(JSON.parse(body), null, 2)}\n\`\`\`\n`;
    } catch {
      return `\`\`\`json\n${body}\n\`\`\`\n`;
    }
  }
  const looksMd =
    url.endsWith(".md") ||
    type.includes("markdown") ||
    type.includes("text/plain");
  if (looksMd && !type.includes("text/html")) return body;
  if (/^\s*</.test(body)) return htmlToMarkdown(body, url);
  return body;
}

function writePage(root, id, markdown) {
  const abs = join(root, "docs", "jev", id);
  mkdirSync(dirname(abs), { recursive: true });
  writeFileSync(abs, markdown, "utf8");
}

function buildPrimer(root, primerPaths, fetchedAt) {
  const chunks = [];
  for (const rel of primerPaths) {
    const abs = join(root, "docs", "jev", rel);
    try {
      const raw = readFileSync(abs, "utf8");
      chunks.push(`\n\n# ${rel}\n\n${raw}`);
    } catch {
      chunks.push(`\n\n# ${rel}\n\n_(missing after this refresh)_\n`);
    }
  }
  let primer = `---\nsource: assembled from docs/jev snapshot\nfetched_at: ${fetchedAt}\n---\n\n# Jev primer (app context)\n\nThis file is generated. Prefer the individual pages in this folder.\n${chunks.join("")}`;
  if (primer.length > PRIMER_CAP) {
    primer = `${primer.slice(0, PRIMER_CAP)}\n\n---\n\n_[primer truncated to ${PRIMER_CAP} characters]_\n`;
  }
  writePage(root, "primer.md", primer);
}

function buildIndex(root, rows, fetchedAt) {
  const ok = rows.filter((r) => r.ok);
  const failed = rows.filter((r) => !r.ok);
  const lines = [
    "---",
    `source: snapshot index`,
    `fetched_at: ${fetchedAt}`,
    "---",
    "",
    "# Jev docs snapshot",
    "",
    `Fetched **${ok.length}** pages, **${failed.length}** failed, at ${fetchedAt}.`,
    "",
    "Refresh with **Update Jev docs** in the app or `npm run update-jev-docs`.",
    "",
    "## Files",
    "",
    "| Path | Title | Status | Source |",
    "|---|---|---|---|",
  ];
  for (const row of rows) {
    const st = row.ok ? "ok" : `fail ${row.status || ""}`.trim();
    lines.push(
      `| \`${row.id}\` | ${row.title.replace(/\|/g, "/")} | ${st} | ${row.url} |`,
    );
  }
  writePage(root, "INDEX.md", `${lines.join("\n")}\n`);
  writePage(
    root,
    "manifest.json",
    `${JSON.stringify(
      {
        fetched_at: fetchedAt,
        ok: ok.length,
        failed: failed.length,
        files: rows.map((r) => ({
          id: r.id,
          title: r.title,
          url: r.url,
          ok: r.ok,
          status: r.status ?? null,
        })),
      },
      null,
      2,
    )}\n`,
  );
}

export async function updateJevDocs(root = defaultRoot) {
  const fetchedAt = isoNow();
  const catalog = loadCatalog(root);
  const dest = join(root, "docs", "jev");
  mkdirSync(dest, { recursive: true });

  const jobs = [];

  const llms = await fetchText(LLMS);
  if (!llms.ok) {
    throw new Error(`Could not fetch ${LLMS} (${llms.status})`);
  }
  writePage(root, "typesafe/llms.txt.md", wrapMarkdown(llms.body, LLMS, fetchedAt));
  jobs.push({
    id: "typesafe/llms.txt.md",
    title: "TypeSafe docs index (llms.txt)",
    url: LLMS,
    ok: true,
    status: 200,
  });

  for (const item of parseLlmsTxt(llms.body)) {
    jobs.push({
      id: typesafeRelPath(item.url),
      title: item.title,
      url: item.url,
      pending: true,
    });
  }
  for (const extra of catalog.extra || []) {
    jobs.push({
      id: extra.id,
      title: extra.title,
      url: extra.url,
      pending: true,
    });
  }

  const pending = jobs.filter((j) => j.pending);
  const results = await mapPool(pending, CONCURRENCY, async (job) => {
    try {
      const got = await fetchText(job.url);
      if (!got.ok) {
        return { ...job, pending: false, ok: false, status: got.status };
      }
      const md = wrapMarkdown(toMarkdown(job.url, got.body, got.type), job.url, fetchedAt);
      writePage(root, job.id, md);
      return { ...job, pending: false, ok: true, status: got.status };
    } catch (err) {
      return {
        ...job,
        pending: false,
        ok: false,
        status: 0,
        error: err instanceof Error ? err.message : "fetch failed",
      };
    }
  });

  const byId = new Map();
  for (const row of jobs) {
    if (!row.pending) byId.set(row.id, row);
  }
  for (const row of results) byId.set(row.id, row);
  const rows = [...byId.values()].sort((a, b) => a.id.localeCompare(b.id));

  // Drop stale files only under generated trees that we fully re-list? Keep extras + typesafe together; rewrite INDEX/primer/manifest always.
  buildPrimer(root, catalog.primerPaths || [], fetchedAt);
  buildIndex(root, rows, fetchedAt);

  const ok = rows.filter((r) => r.ok).length;
  const failed = rows.filter((r) => !r.ok).length;
  return {
    ok: failed === 0,
    fetchedAt,
    fetched: ok,
    failed,
    files: rows.length,
    dest: relative(root, dest),
  };
}

const isMain =
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url);

if (isMain) {
  updateJevDocs(defaultRoot)
    .then((r) => {
      console.log(
        `Jev docs: ${r.fetched} ok, ${r.failed} failed, ${r.files} listed → ${r.dest}`,
      );
      if (r.failed) process.exitCode = 1;
    })
    .catch((err) => {
      console.error(err instanceof Error ? err.message : err);
      process.exit(1);
    });
}
