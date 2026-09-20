import { useState } from "react";
import type { ChatMessage, ChatToolCall } from "./types";
import { MdProse } from "./MdProse";

const TOOL_LABEL: Record<string, string> = {
  read_jev_workshop: "Read pane",
  set_jev_state: "Jev’s State",
  set_jev_questions: "Jev’s Questions",
  ask_jev: "Ask Jev",
};

export function ThinkingMill({ label = "Thinking" }: { label?: string }) {
  return (
    <div className="llm-thinking" role="status" aria-live="polite" aria-label={label}>
      <span className="llm-thinking-label">{label}</span>
      <span className="llm-mill-track" aria-hidden="true">
        <span className="llm-mill-nib" />
      </span>
      <span className="llm-stamps" aria-hidden="true">
        <i />
        <i />
        <i />
      </span>
    </div>
  );
}

function ThoughtsBlock({ text, streaming }: { text: string; streaming: boolean }) {
  const [open, setOpen] = useState(streaming);
  const [prevStreaming, setPrevStreaming] = useState(streaming);
  if (streaming !== prevStreaming) {
    setPrevStreaming(streaming);
    setOpen(streaming);
  }
  if (!text.trim()) return null;
  return (
    <div className={open ? "llm-thoughts open" : "llm-thoughts"}>
      <button
        type="button"
        className="llm-agent-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="llm-agent-kicker">Thoughts</span>
        <span className="llm-agent-meta">{streaming ? "streaming" : "done"}</span>
        <span className="llm-agent-chevron" aria-hidden="true">
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open ? <pre className="llm-thoughts-body">{text}</pre> : null}
    </div>
  );
}

function ToolCard({ tool }: { tool: ChatToolCall }) {
  const running = tool.status === "running";
  const failed = tool.status === "done" && tool.ok === false;
  const [open, setOpen] = useState(true);
  const stamp = running ? "Running" : failed ? "Failed" : "Done";
  const label = TOOL_LABEL[tool.name] ?? tool.name;
  return (
    <div
      className={`llm-tool${running ? " running" : ""}${failed ? " failed" : ""}`}
    >
      <button
        type="button"
        className="llm-agent-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="llm-tool-name">
          <span className="llm-tool-label">{label}</span>
          <code>{tool.name}</code>
        </span>
        <span className={`llm-tool-stamp ${running ? "run" : failed ? "fail" : "ok"}`}>
          {stamp}
        </span>
        <span className="llm-agent-chevron" aria-hidden="true">
          {open ? "▾" : "▸"}
        </span>
      </button>
      {open ? (
        <div className="llm-tool-body">
          {tool.argsSummary ? (
            <p>
              <span className="llm-tool-k">Args</span>
              {tool.argsSummary}
            </p>
          ) : null}
          {tool.resultSummary ? (
            <p>
              <span className="llm-tool-k">Result</span>
              {tool.resultSummary}
            </p>
          ) : running ? (
            <p className="llm-tool-wait">Working the pane…</p>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export function LlmBubble({
  message,
  streaming,
}: {
  message: ChatMessage;
  streaming: boolean;
}) {
  const thoughts = message.thoughts?.trim() ?? "";
  const tools = message.tools ?? [];
  const prose = message.content;
  const showThinking = streaming && !prose.trim();

  return (
    <div className="bubble assistant">
      <span className="who">LLM</span>
      {showThinking ? <ThinkingMill /> : null}
      <ThoughtsBlock text={thoughts} streaming={streaming && !prose.trim()} />
      {tools.map((t) => (
        <ToolCard key={t.id} tool={t} />
      ))}
      {prose ? <MdProse text={prose} /> : null}
    </div>
  );
}
