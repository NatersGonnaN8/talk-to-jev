import mammoth from "mammoth";
import { htmlToMarkdown } from "./html";

export async function docxToMarkdown(buffer: ArrayBuffer): Promise<string> {
  const result = await mammoth.convertToHtml(
    { arrayBuffer: buffer },
    {
      convertImage: mammoth.images.imgElement(async () => ({ src: "" })),
    },
  );
  const md = htmlToMarkdown(result.value);
  if (!md) {
    throw new Error("That Word file had no text to convert.");
  }
  return md;
}
