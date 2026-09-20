import { useRef } from "react";
import { FlipTip } from "./FlipTip";
import { CONVERT_ACCEPT, MARKDOWN_ACCEPT } from "./convert/formats";

export function AttachBar({
  names,
  error,
  onPickMarkdown,
  onPickConvert,
  onRemove,
}: {
  names: string[];
  error: string;
  onPickMarkdown: (files: FileList) => void;
  onPickConvert: (files: FileList) => void;
  onRemove: (name: string) => void;
}) {
  const mdRef = useRef<HTMLInputElement>(null);
  const convertRef = useRef<HTMLInputElement>(null);

  return (
    <div className="attach-bar">
      <div className="attach-row">
        <FlipTip text="Local .md becomes Jev state. Stays in the browser.">
          <button
            type="button"
            className="btn ghost"
            onClick={() => mdRef.current?.click()}
          >
            Add .md
          </button>
        </FlipTip>
        <FlipTip text="Convert txt, html, docx, or pdf in this browser. Files never leave the machine.">
          <button
            type="button"
            className="btn ghost"
            onClick={() => convertRef.current?.click()}
          >
            Convert to Markdown
          </button>
        </FlipTip>
        <input
          ref={mdRef}
          className="attach-file"
          type="file"
          accept={MARKDOWN_ACCEPT}
          multiple
          aria-label="Attach markdown files"
          onChange={(e) => {
            const list = e.currentTarget.files;
            if (list?.length) onPickMarkdown(list);
            e.currentTarget.value = "";
          }}
        />
        <input
          ref={convertRef}
          className="attach-file"
          type="file"
          accept={CONVERT_ACCEPT}
          multiple
          aria-label="Convert files to markdown"
          onChange={(e) => {
            const list = e.currentTarget.files;
            if (list?.length) onPickConvert(list);
            e.currentTarget.value = "";
          }}
        />
        {names.length ? (
          <ul className="attach-list" aria-label="Attached markdown">
            {names.map((name) => (
              <li key={name} className="attach-chip">
                <span>{name}</span>
                <button
                  type="button"
                  className="btn tiny"
                  aria-label={`Remove ${name}`}
                  onClick={() => onRemove(name)}
                >
                  ×
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </div>
      {error ? (
        <p className="inline-error" role="alert">
          {error}
        </p>
      ) : null}
    </div>
  );
}
