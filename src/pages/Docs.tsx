import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { checkDocEmbed, listDocs, readDoc } from "../api";
import {
  embedForDoc,
  embedIsBlocked,
  loadDocsView,
  loadEmbedBlocks,
  rememberEmbedBlock,
  saveDocsView,
  sourceFromHeader,
  type DocsView,
  type EmbedBlockPrefs,
} from "../docsEmbed";
import {
  compareDocs,
  docMatchesSearch,
  docMatchesTags,
  docType,
  loadDocsRailPrefs,
  saveDocsRailPrefs,
  type DocListItem,
  type DocsSort,
} from "../docsRail";
import { FlipTip } from "../FlipTip";
import { toNiceHtml } from "../markdown";

function IconEye() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
      <path
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M2.2 12s3.6-6.2 9.8-6.2S21.8 12 21.8 12 18.2 18.2 12 18.2 2.2 12 2.2 12Z"
      />
      <circle
        cx="12"
        cy="12"
        r="2.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
    </svg>
  );
}

function IconCode() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        points="9 18 3 12 9 6"
      />
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        points="15 6 21 12 15 18"
      />
    </svg>
  );
}

/** Literal i in a box — not a globe or browser chrome. */
function IconIframe() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="18" height="18">
      <rect
        x="4.25"
        y="4.25"
        width="15.5"
        height="15.5"
        rx="2.2"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
      />
      <circle cx="12" cy="8.35" r="1.15" fill="currentColor" />
      <path
        d="M12 11.15v6.1"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    </svg>
  );
}

function IconRailFold({ open }: { open: boolean }) {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" width="16" height="16">
      <polyline
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
        points={open ? "14 6 8 12 14 18" : "10 6 16 12 10 18"}
      />
    </svg>
  );
}

type EmbedProbe = "off" | "pending" | "yes" | "no" | "unknown";

function DocIframe({
  src,
  onBlocked,
}: {
  src: string;
  onBlocked: (src: string) => void;
}) {
  const alive = useRef(true);
  const blocked = useRef(false);

  useEffect(() => {
    alive.current = true;
    blocked.current = false;
    void checkDocEmbed(src).then((embed) => {
      if (!alive.current || blocked.current) return;
      if (embed === false) {
        blocked.current = true;
        onBlocked(src);
      }
    });
    return () => {
      alive.current = false;
    };
  }, [src, onBlocked]);

  return (
    <div className="doc-frame-wrap">
      <iframe
        key={src}
        className="doc-frame"
        title="Live source"
        src={src}
        referrerPolicy="no-referrer"
        onLoad={(e) => {
          const frame = e.currentTarget;
          window.setTimeout(() => {
            if (!alive.current || blocked.current) return;
            try {
              const href = frame.contentWindow?.location.href ?? "";
              if (!href || href === "about:blank") {
                blocked.current = true;
                onBlocked(src);
              }
            } catch {
              /* cross-origin document — probe already decided, or the page loaded */
            }
          }, 200);
        }}
      />
    </div>
  );
}

export function DocsPage({ snapshotTick }: { snapshotTick: number }) {
  const boot = useMemo(() => loadDocsRailPrefs(), []);
  const [files, setFiles] = useState<DocListItem[]>([]);
  const [ready, setReady] = useState(false);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<DocsSort>(boot.sort);
  const [tags, setTags] = useState<string[]>(boot.tags);
  const [collapsed, setCollapsed] = useState(boot.collapsed);
  const [active, setActive] = useState("");
  const [text, setText] = useState("");
  const [view, setView] = useState<DocsView>(() => loadDocsView());
  const [err, setErr] = useState("");
  const [blockPrefs, setBlockPrefs] = useState<EmbedBlockPrefs>(() =>
    loadEmbedBlocks(),
  );
  const [probe, setProbe] = useState<EmbedProbe>("off");
  const activeRef = useRef(active);
  activeRef.current = active;
  const loadSeq = useRef(0);
  const railRef = useRef<HTMLElement>(null);
  const toggleRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(async () => {
    const seq = ++loadSeq.current;
    try {
      const data = await listDocs();
      if (seq !== loadSeq.current) return;
      setFiles(data.files);
      setReady(true);
      const selected = activeRef.current;
      if (!selected) {
        setErr("");
        return;
      }
      if (!data.files.some((f) => f.path === selected)) {
        setActive("");
        setText("");
        setErr("");
        return;
      }
      const doc = await readDoc(selected);
      if (seq !== loadSeq.current) return;
      if (activeRef.current !== selected) return;
      setText(doc.text);
      setErr("");
    } catch (e) {
      if (seq !== loadSeq.current) return;
      setReady(true);
      setErr(e instanceof Error ? e.message : "Could not list docs");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load, snapshotTick]);

  useEffect(() => {
    saveDocsRailPrefs({ v: 1, sort, tags, collapsed });
  }, [sort, tags, collapsed]);

  useEffect(() => {
    saveDocsView(view);
  }, [view]);

  const knownTags = useMemo(() => {
    if (files.length === 0) return tags;
    const known = new Set(files.map((f) => docType(f.path)));
    return tags.filter((t) => known.has(t));
  }, [files, tags]);

  const typeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const f of files) {
      const type = docType(f.path);
      if (!counts.has(type)) counts.set(type, 0);
      if (docMatchesSearch(f, q)) {
        counts.set(type, (counts.get(type) ?? 0) + 1);
      }
    }
    return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [files, q]);

  const shown = useMemo(() => {
    return files
      .filter((f) => docMatchesSearch(f, q) && docMatchesTags(docType(f.path), knownTags))
      .sort((a, b) => compareDocs(a, b, sort));
  }, [files, q, knownTags, sort]);

  const catalogSource = files.find((f) => f.path === active)?.source ?? "";
  const embed = useMemo(
    () => embedForDoc(active, catalogSource || sourceFromHeader(text)),
    [active, catalogSource, text],
  );
  const embedSrc = embed.ok ? embed.src : "";
  const alreadyBlocked = embedSrc ? embedIsBlocked(embedSrc, blockPrefs) : false;

  useEffect(() => {
    if (!embedSrc) {
      setProbe("off");
      return;
    }
    if (alreadyBlocked) {
      setProbe("no");
      return;
    }
    let alive = true;
    setProbe("pending");
    void checkDocEmbed(embedSrc).then((ok) => {
      if (!alive) return;
      if (ok === false) {
        setBlockPrefs((cur) => rememberEmbedBlock(embedSrc, cur));
        setProbe("no");
        return;
      }
      setProbe(ok === true ? "yes" : "unknown");
    });
    return () => {
      alive = false;
    };
  }, [embedSrc, alreadyBlocked]);

  const iframeOffered = probe === "yes" || probe === "unknown";
  const shownView: DocsView =
    view === "iframe" && !iframeOffered ? "nice" : view;

  const niceHtml = useMemo(() => {
    if (!active || !text) return "";
    return toNiceHtml(text, active);
  }, [active, text]);

  const open = async (path: string) => {
    const seq = ++loadSeq.current;
    setActive(path);
    try {
      const doc = await readDoc(path);
      if (seq !== loadSeq.current) return;
      setText(doc.text);
      setErr("");
    } catch (e) {
      if (seq !== loadSeq.current) return;
      setErr(e instanceof Error ? e.message : "Could not open doc");
    }
  };

  const toggleSort = () => setSort((s) => (s === "asc" ? "desc" : "asc"));

  const toggleTag = (id: string) => {
    setTags((cur) =>
      cur.includes(id) ? cur.filter((t) => t !== id) : [...cur, id],
    );
  };

  const onIframeBlocked = useCallback((src: string) => {
    setBlockPrefs((cur) => rememberEmbedBlock(src, cur));
    setProbe("no");
  }, []);

  const toggleRail = () => {
    setCollapsed((c) => {
      const next = !c;
      if (next && railRef.current?.contains(document.activeElement)) {
        queueMicrotask(() => toggleRef.current?.focus());
      }
      return next;
    });
  };

  const railOpen = !collapsed;
  const foldTip = railOpen ? "Hide docs list" : "Show docs list";

  return (
    <main className={collapsed ? "docs is-collapsed" : "docs"}>
      <aside
        ref={railRef}
        id="doc-rail"
        className="doc-rail"
        aria-label="Docs snapshot"
        inert={collapsed}
      >
        <div className="doc-rail-head">
          <input
            className="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search snapshot"
          />
          <div className="doc-rail-tools">
            <button
              type="button"
              className="doc-sort"
              aria-pressed={sort === "desc"}
              aria-label={
                sort === "asc"
                  ? "Sort by title, A to Z. Activate for Z to A."
                  : "Sort by title, Z to A. Activate for A to Z."
              }
              onClick={toggleSort}
            >
              {sort === "asc" ? "A→Z" : "Z→A"}
            </button>
            {knownTags.length > 0 ? (
              <button
                type="button"
                className="doc-tag-clear"
                onClick={() => setTags([])}
              >
                Clear
              </button>
            ) : null}
          </div>
          {typeCounts.length > 0 ? (
            <div className="doc-type-chips" role="group" aria-label="Doc types">
              {typeCounts.map(([id, count]) => {
                const on = knownTags.includes(id);
                return (
                  <button
                    key={id}
                    type="button"
                    className={on ? "doc-type-chip on" : "doc-type-chip"}
                    aria-pressed={on}
                    onClick={() => toggleTag(id)}
                  >
                    {id}
                    <span className="doc-type-n">{count}</span>
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
        <div className="doc-list">
          {err ? <p className="empty">{err}</p> : null}
          {!ready ? (
            <p className="empty">Loading snapshot…</p>
          ) : files.length === 0 ? (
            <p className="empty">
              Snapshot is empty. Use Update Jev docs or `npm run update-jev-docs`.
            </p>
          ) : shown.length === 0 ? (
            <p className="empty">No pages match these filters.</p>
          ) : (
            <ul>
              {shown.map((f) => (
                <li key={f.path}>
                  <button
                    type="button"
                    className={active === f.path ? "doc-link on" : "doc-link"}
                    onClick={() => void open(f.path)}
                  >
                    <strong>{f.title}</strong>
                    <span>{f.path}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </aside>
      <div className="doc-rail-seam">
        <FlipTip text={foldTip}>
          <button
            ref={toggleRef}
            type="button"
            className="doc-rail-toggle"
            aria-expanded={railOpen}
            aria-controls="doc-rail"
            aria-label={foldTip}
            onClick={toggleRail}
          >
            <IconRailFold open={railOpen} />
          </button>
        </FlipTip>
      </div>
      <article
        className={shownView === "iframe" ? "doc-view is-frame" : "doc-view"}
      >
        {active && text ? (
          <div
            className="doc-overlay"
            data-tutorial="docs-view"
            role="group"
            aria-label="Docs view"
          >
            <button
              type="button"
              className={shownView === "nice" ? "view-btn on" : "view-btn"}
              aria-pressed={shownView === "nice"}
              aria-label="Nice view"
              onClick={() => setView("nice")}
            >
              <IconEye />
              <span className="tip">Nice view</span>
            </button>
            <button
              type="button"
              className={shownView === "code" ? "view-btn on" : "view-btn"}
              aria-pressed={shownView === "code"}
              aria-label="Code view"
              onClick={() => setView("code")}
            >
              <IconCode />
              <span className="tip">Code view</span>
            </button>
            {iframeOffered ? (
              <button
                type="button"
                className={shownView === "iframe" ? "view-btn on" : "view-btn"}
                aria-pressed={shownView === "iframe"}
                aria-label="Iframe"
                onClick={() => setView("iframe")}
              >
                <IconIframe />
                <span className="tip">Iframe</span>
              </button>
            ) : null}
          </div>
        ) : null}
        {!active ? (
          <p className="empty pick">Pick a page from the snapshot.</p>
        ) : shownView === "iframe" && embed.ok ? (
          <DocIframe src={embed.src} onBlocked={onIframeBlocked} />
        ) : shownView === "code" ? (
          <pre className="doc-code">{text}</pre>
        ) : (
          <div
            className="md-nice"
            dangerouslySetInnerHTML={{ __html: niceHtml }}
          />
        )}
      </article>
    </main>
  );
}
