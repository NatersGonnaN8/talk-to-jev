import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FlipTip } from "./FlipTip";
import { MAX_ATTACH_CHARS } from "./attach";
import {
  CONVERT_ACCEPT,
  MAX_CONVERT_BATCH,
  MAX_CONVERT_BYTES,
  convertFormatOf,
  markdownNameFrom,
  miB,
  partitionDroppedFiles,
} from "./convert/formats";
import { downloadMarkdown, saveMarkdown } from "./convert/saveMd";
import { fileToMarkdown } from "./convert/toMarkdown";
import {
  JEV_REQUEST_TOKEN_BUDGET,
  JEV_STATE_PLUS_LONGEST_Q,
  tokenCheck,
} from "./convert/tokens";

export type ConvertJobStatus = "queued" | "reading" | "converting" | "done" | "error";

export type ConvertJob = {
  id: string;
  fileName: string;
  status: ConvertJobStatus;
  ratio: number;
  label: string;
  markdown: string;
  error: string;
};

function newId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

function jobFromFile(file: File): ConvertJob {
  const format = convertFormatOf(file);
  if (format === "doc") {
    return {
      id: newId(),
      fileName: file.name || "file.doc",
      status: "error",
      ratio: 0,
      label: "Error",
      markdown: "",
      error: "Save as .docx — this browser cannot read legacy Word .doc.",
    };
  }
  if (file.size > MAX_CONVERT_BYTES) {
    return {
      id: newId(),
      fileName: file.name || "file",
      status: "error",
      ratio: 0,
      label: "Error",
      markdown: "",
      error: `Too large: ${file.name} (max ${miB(MAX_CONVERT_BYTES)})`,
    };
  }
  return {
    id: newId(),
    fileName: file.name || "file",
    status: "queued",
    ratio: 0,
    label: "Queued",
    markdown: "",
    error: "",
  };
}

let lastBatchId = "";

export function ConvertPane({
  batch,
  caseText,
  onBatchConsumed,
  onAddToCase,
  onAddToLlm,
  onEnqueue,
}: {
  batch: { id: string; files: File[] } | null;
  caseText: string;
  onBatchConsumed: () => void;
  onAddToCase: (filename: string, markdown: string) => { ok: boolean; message: string };
  onAddToLlm: (filename: string, markdown: string) => void;
  onEnqueue: (files: File[]) => void;
}) {
  const [jobs, setJobs] = useState<ConvertJob[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [actionMsg, setActionMsg] = useState("");
  const [dropMsg, setDropMsg] = useState("");
  const [dropOn, setDropOn] = useState(false);
  const [split, setSplit] = useState(38);
  const filesRef = useRef<Map<string, File>>(new Map());
  const running = useRef(false);
  const dragDepth = useRef(0);
  const pickRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!batch || batch.id === lastBatchId) return;
    lastBatchId = batch.id;
    const take = batch.files.slice(0, MAX_CONVERT_BATCH);
    const overflow = batch.files.length - take.length;
    const created = take.map((file) => {
      const job = jobFromFile(file);
      if (job.status === "queued") filesRef.current.set(job.id, file);
      return job;
    });
    setJobs((prev) => [...prev, ...created]);
    setSelectedId((id) => id ?? created[0]?.id ?? null);
    if (overflow > 0) {
      setActionMsg(`At most ${MAX_CONVERT_BATCH} convert files at a time. Skipped ${overflow}.`);
    }
    onBatchConsumed();
  }, [batch, onBatchConsumed]);

  useEffect(() => {
    const next = jobs.find((j) => j.status === "queued");
    if (!next || running.current) return;
    const file = filesRef.current.get(next.id);
    if (!file) {
      setJobs((js) =>
        js.map((j) =>
          j.id === next.id
            ? { ...j, status: "error", label: "Error", error: "Could not read that file." }
            : j,
        ),
      );
      return;
    }
    running.current = true;
    setJobs((js) =>
      js.map((j) =>
        j.id === next.id ? { ...j, status: "reading", ratio: 0.05, label: "Reading" } : j,
      ),
    );
    void (async () => {
      try {
        const markdown = await fileToMarkdown(file, (p) => {
          setJobs((js) =>
            js.map((j) =>
              j.id === next.id
                ? {
                    ...j,
                    status: "converting",
                    ratio: p.ratio,
                    label: p.label,
                  }
                : j,
            ),
          );
        });
        setJobs((js) =>
          js.map((j) =>
            j.id === next.id
              ? {
                  ...j,
                  status: "done",
                  ratio: 1,
                  label: "Done",
                  markdown,
                  error: "",
                }
              : j,
          ),
        );
        setSelectedId((id) => id ?? next.id);
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Could not convert that file.";
        setJobs((js) =>
          js.map((j) =>
            j.id === next.id
              ? { ...j, status: "error", ratio: 0, label: "Error", error: message }
              : j,
          ),
        );
      } finally {
        filesRef.current.delete(next.id);
        running.current = false;
      }
    })();
  }, [jobs]);

  const takeLocalFiles = (list: FileList | File[]) => {
    const files = Array.from(list);
    if (!files.length) return;
    const { markdown, convert, unsupported } = partitionDroppedFiles(files);
    const bits: string[] = [];
    if (unsupported.length) bits.push(`Not supported: ${unsupported.join(", ")}`);
    if (markdown.length) {
      bits.push("Drop .md on Jev’s State in Workshop — it attaches as state, no convert.");
    }
    setDropMsg(bits.filter(Boolean).join(" "));
    if (convert.length) onEnqueue(convert);
  };

  const onDragEnter = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    dragDepth.current += 1;
    setDropOn(true);
  };

  const onDragOver = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "copy";
  };

  const onDragLeave = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    dragDepth.current -= 1;
    if (dragDepth.current <= 0) {
      dragDepth.current = 0;
      setDropOn(false);
    }
  };

  const onDrop = (e: React.DragEvent<HTMLElement>) => {
    e.preventDefault();
    dragDepth.current = 0;
    setDropOn(false);
    const files = e.dataTransfer.files;
    if (files?.length) takeLocalFiles(files);
  };

  const onSplitPointer = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    const rail = e.currentTarget.parentElement;
    if (!rail) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    const move = (ev: PointerEvent) => {
      const rect = rail.getBoundingClientRect();
      const x = ((ev.clientX - rect.left) / rect.width) * 100;
      setSplit(Math.min(72, Math.max(28, x)));
    };
    const up = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
  }, []);

  const selected = useMemo(
    () => jobs.find((j) => j.id === selectedId) ?? jobs[0] ?? null,
    [jobs, selectedId],
  );

  const tokens = selected?.status === "done" ? tokenCheck(selected.markdown, caseText) : null;
  const tooLongForCase = (selected?.markdown.length ?? 0) > MAX_ATTACH_CHARS;
  const blockCase = Boolean(tokens?.overRequest || tooLongForCase);

  const onAddCase = () => {
    if (!selected || selected.status !== "done") return;
    if (blockCase) return;
    const name = markdownNameFrom(selected.fileName);
    const result = onAddToCase(name, selected.markdown);
    setActionMsg(result.message);
  };

  const onAddLlm = () => {
    if (!selected || selected.status !== "done") return;
    onAddToLlm(selected.fileName, selected.markdown);
    setActionMsg("Added converted markdown to the LLM thread.");
  };

  const onDownload = () => {
    if (!selected || selected.status !== "done") return;
    downloadMarkdown(markdownNameFrom(selected.fileName), selected.markdown);
    setActionMsg("Downloaded markdown.");
  };

  const onSave = async () => {
    if (!selected || selected.status !== "done") return;
    const how = await saveMarkdown(markdownNameFrom(selected.fileName), selected.markdown);
    if (how === "abort") return;
    setActionMsg(how === "saved" ? "Saved markdown." : "Downloaded markdown.");
  };

  return (
    <main
      className="convert-page"
      data-tutorial="convert-page"
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
    >
      <section className="convert-intro">
        <span className="eyebrow">In this browser</span>
        <h1 className="pane-title">Convert to Markdown</h1>
        <p>
          Drop txt, html, docx, or pdf here. Files never leave this machine — no
          OCR, no upload. Add the result to the LLM, to Jev’s State, or save a
          .md. Dropping convertables on Jev’s State opens this tab. Drop .md on
          Workshop instead.
        </p>
      </section>
      <section className="convert-board">
        <div
          className={dropOn ? "convert-rail drop-on" : "convert-rail"}
          style={{ flex: `${split} 1 0` }}
        >
          <header className="pane-head">
            <div>
              <h2 className="pane-title">Files</h2>
              <p className="pane-meta">txt · html · docx · pdf</p>
            </div>
            <FlipTip text="Convert txt, html, docx, or pdf in this browser. Files never leave the machine.">
              <button
                type="button"
                className="btn ghost"
                onClick={() => pickRef.current?.click()}
              >
                Choose files
              </button>
            </FlipTip>
            <input
              ref={pickRef}
              className="attach-file"
              type="file"
              accept={CONVERT_ACCEPT}
              multiple
              aria-label="Convert to Markdown"
              onChange={(e) => {
                const list = e.currentTarget.files;
                if (list?.length) takeLocalFiles(list);
                e.currentTarget.value = "";
              }}
            />
          </header>
          <p className="convert-drop-hint">
            Drop files on this page, or onto Jev’s State to land here.
          </p>
          {dropMsg ? (
            <p className="inline-error" role="alert">
              {dropMsg}
            </p>
          ) : null}
          <ul className="convert-jobs" aria-label="Convert progress">
            {jobs.length === 0 ? (
              <li className="empty">No files yet. Drop txt, html, docx, or pdf.</li>
            ) : (
              jobs.map((job) => (
                <li key={job.id}>
                  <button
                    type="button"
                    className={
                      selected?.id === job.id ? "convert-job on" : "convert-job"
                    }
                    onClick={() => setSelectedId(job.id)}
                  >
                    <span className="convert-job-name">{job.fileName}</span>
                    <span className={`convert-job-status ${job.status}`}>{job.label}</span>
                    <span className="convert-meter" aria-hidden="true">
                      <span style={{ width: `${Math.round(job.ratio * 100)}%` }} />
                    </span>
                  </button>
                  {job.status === "error" ? (
                    <p className="inline-error" role="alert">
                      {job.error}
                    </p>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </div>
        <div
          className="splitter"
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize convert panes"
          onPointerDown={onSplitPointer}
        />
        <article
          className="convert-stage"
          data-tutorial="convert"
          style={{ flex: `${100 - split} 1 0` }}
        >
          <header className="pane-head">
            <div>
              <h2 className="pane-title">Markdown</h2>
              <p className="pane-meta">in this browser · files stay here</p>
            </div>
          </header>
          <p className="convert-note">
            Jev context window ~{JEV_REQUEST_TOKEN_BUDGET.toLocaleString()} tokens
            (TypeSafe). State + longest question: {JEV_STATE_PLUS_LONGEST_Q.toLocaleString()}.
            Rough estimate: 4 characters ≈ 1 token.
          </p>
          {selected?.status === "done" ? (
            <>
              <textarea
                className="convert-preview"
                value={selected.markdown}
                readOnly
                rows={10}
                aria-label="Converted markdown"
              />
              {tokens ? (
                <p
                  className={
                    tokens.overRequest
                      ? "inline-error"
                      : tokens.overState
                        ? "convert-warn"
                        : "meta"
                  }
                >
                  ~{tokens.mdTokens.toLocaleString()} tokens in this file
                  {tokens.combinedTokens !== tokens.mdTokens
                    ? ` · ~${tokens.combinedTokens.toLocaleString()} with Jev’s State`
                    : ""}
                  {tokens.overRequest
                    ? ` — over Jev’s ${JEV_REQUEST_TOKEN_BUDGET.toLocaleString()}-token request budget. Cannot add to Jev’s State.`
                    : tokens.overState
                      ? ` — over the ${JEV_STATE_PLUS_LONGEST_Q.toLocaleString()}-token state + longest-question budget. Adding this may fail at Jev.`
                      : ""}
                </p>
              ) : null}
              {tooLongForCase ? (
                <p className="inline-error" role="alert">
                  Over {MAX_ATTACH_CHARS.toLocaleString()} characters — too large for Jev’s State.
                </p>
              ) : null}
              <div className="row-actions convert-actions">
                <FlipTip text="Puts the markdown in the LLM thread. Does not send it.">
                  <button type="button" className="btn ghost" onClick={onAddLlm}>
                    Add to the LLM
                  </button>
                </FlipTip>
                <FlipTip text="Merges into Jev’s State as an attach block. Stays in the browser.">
                  <button
                    type="button"
                    className="btn solid"
                    disabled={blockCase}
                    onClick={onAddCase}
                  >
                    Add to Jev’s State
                  </button>
                </FlipTip>
                <button type="button" className="btn ghost" onClick={onDownload}>
                  Download
                </button>
                <button type="button" className="btn ghost" onClick={() => void onSave()}>
                  Save as MD
                </button>
              </div>
            </>
          ) : selected?.status === "error" ? (
            <p className="hint">
              {selected.error === "scan / no selectable text"
                ? "This PDF has no text layer (scan / no selectable text). Talk to Jev does not OCR."
                : selected.error.includes("Save as .docx")
                  ? "Legacy .doc is OLE. Save as .docx in Word and drop that."
                  : "Fix the file and drop it again."}
            </p>
          ) : (
            <p className="empty">Pick a finished file to preview markdown.</p>
          )}
          {actionMsg ? <p className="meta">{actionMsg}</p> : null}
          <p className="convert-foot">
            PDF text layer only — no images, no OCR, no upload. Heavier local tool:{" "}
            <a href="https://pandoc.org/" target="_blank" rel="noreferrer">
              Pandoc
            </a>
            .
          </p>
        </article>
      </section>
    </main>
  );
}
