import { useRef } from "react";
import { FlipTip } from "./FlipTip";
import { MARKDOWN_ACCEPT } from "./convert/formats";

export function AttachBar({
  names,
  error,
  onPickMarkdown,
  onRemove,
}: {
  names: string[];
  error: string;
  onPickMarkdown: (files: FileList) => void;
  onRemove: (name: string) => void;
}) {
  const mdRef = useRef<HTMLInputElement>(null);

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
