import TurndownService from "turndown";

let service: TurndownService | null = null;

function turndown(): TurndownService {
  if (service) return service;
  service = new TurndownService({
    headingStyle: "atx",
    codeBlockStyle: "fenced",
    bulletListMarker: "-",
    emDelimiter: "*",
  });
  service.addRule("dropMedia", {
    filter: (node) => {
      const tag = node.nodeName.toLowerCase();
      return ["img", "svg", "canvas", "video", "audio", "picture", "source"].includes(
        tag,
      );
    },
    replacement: () => "",
  });
  return service;
}

export function htmlToMarkdown(html: string): string {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc
    .querySelectorAll("script,iframe,object,embed,link,meta,style,img,svg,canvas,video,audio")
    .forEach((n) => n.remove());
  return turndown().turndown(doc.body.innerHTML).trim();
}
