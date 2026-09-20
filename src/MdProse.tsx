import { useMemo } from "react";
import { toProseHtml } from "./markdown";

/** Sanitized CommonMark-ish prose. Never a Docs Nice iframe. */
export function MdProse({
  text,
  className,
}: {
  text: string;
  className?: string;
}) {
  const html = useMemo(() => toProseHtml(text), [text]);
  if (!text) return null;
  return (
    <div
      className={className ? `md-prose ${className}` : "md-prose"}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
