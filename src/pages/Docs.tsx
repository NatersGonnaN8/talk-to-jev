import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { listDocs, readDoc } from "../api";
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

export function DocsPage({ snapshotTick }: { snapshotTick: number }) {
  const boot = useMemo(() => loadDocsRailPrefs(), []);
  const [files, setFiles] = useState<DocListItem[]>([]);
  const [ready, setReady] = useState(false);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<DocsSort>(boot.sort);
  const [tags, setTags] = useState<string[]>(boot.tags);
  const [active, setActive] = useState("");
  const [text, setText] = useState("");
  const [view, setView] = useState<"nice" | "code">("nice");
  const [err, setErr] = useState("");
  const activeRef = useRef(active);
  activeRef.current = active;
  const loadSeq = useRef(0);

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
    saveDocsRailPrefs({ v: 1, sort, tags });
  }, [sort, tags]);

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

  return (
    <main className="docs">
      <aside className="doc-rail">
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
      </aside>
      <article className="doc-view">
        {active && text ? (
          <div
            className="doc-overlay"
            data-tutorial="docs-view"
            role="group"
            aria-label="Markdown view"
          >
            <button
              type="button"
              className={view === "nice" ? "view-btn on" : "view-btn"}
              aria-pressed={view === "nice"}
              aria-label="Nice view"
              onClick={() => setView("nice")}
            >
              <IconEye />
              <span className="tip">Nice view</span>
            </button>
            <button
              type="button"
              className={view === "code" ? "view-btn on" : "view-btn"}
              aria-pressed={view === "code"}
              aria-label="Code view"
              onClick={() => setView("code")}
            >
              <IconCode />
              <span className="tip">Code view</span>
            </button>
          </div>
        ) : null}
        {!active ? (
          <p className="empty pick">Pick a page from the snapshot.</p>
        ) : view === "code" ? (
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
