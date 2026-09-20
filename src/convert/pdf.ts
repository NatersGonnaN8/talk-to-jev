import {
  getDocument,
  GlobalWorkerOptions,
  PasswordException,
} from "pdfjs-dist";
import workerUrl from "pdfjs-dist/build/pdf.worker.min.mjs?url";

let workerReady = false;

function ensureWorker() {
  if (workerReady) return;
  GlobalWorkerOptions.workerSrc = workerUrl;
  workerReady = true;
}

function isTextItem(item: unknown): item is { str: string; hasEOL?: boolean } {
  return Boolean(item && typeof item === "object" && "str" in item);
}

function tick() {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, 0);
  });
}

/** Text layer only. No render, no OCR, no images. */
export async function pdfToMarkdown(
  buffer: ArrayBuffer,
  onProgress?: (page: number, total: number) => void,
): Promise<string> {
  ensureWorker();
  const data = new Uint8Array(buffer.slice(0));
  let pdf;
  try {
    pdf = await getDocument({
      data,
      disableFontFace: true,
      useSystemFonts: false,
      useWasm: false,
      maxImageSize: 1,
    }).promise;
  } catch (err) {
    if (err instanceof PasswordException) {
      throw new Error("This PDF is password-protected.");
    }
    const msg = err instanceof Error ? err.message : "Could not read PDF.";
    throw new Error(msg);
  }

  const pages: string[] = [];
  let chars = 0;
  for (let n = 1; n <= pdf.numPages; n++) {
    onProgress?.(n, pdf.numPages);
    const page = await pdf.getPage(n);
    const content = await page.getTextContent();
    const bits: string[] = [];
    for (const item of content.items) {
      if (!isTextItem(item)) continue;
      bits.push(item.str);
      bits.push(item.hasEOL ? "\n" : " ");
    }
    const text = bits.join("").replace(/[ \t]+\n/g, "\n").trim();
    if (text) {
      pages.push(text);
      chars += text.length;
    }
    await tick();
  }

  if (!chars) {
    throw new Error("scan / no selectable text");
  }

  return pages
    .map((t, i) => (pages.length > 1 ? `## Page ${i + 1}\n\n${t}` : t))
    .join("\n\n");
}
