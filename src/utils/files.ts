// Lightweight file→text extraction. Heavy parsers (pdf, docx, xlsx, pptx)
// can be wired in later; here we cover plain text + markdown + JSON + CSV.

const TEXT_TYPES = /^(text\/|application\/(json|xml|x-yaml|yaml|toml|csv|markdown))/;
const TEXT_EXT = /\.(txt|md|markdown|csv|json|yml|yaml|toml|html|css|js|ts|tsx|jsx|py|rb|go|rs|java|c|cc|cpp|h|hpp|sql)$/i;

export interface ExtractedFile {
  name: string;
  mime: string;
  size: number;
  previewText?: string;
  dataUrl?: string;
}

export async function extractFile(file: File): Promise<ExtractedFile> {
  const result: ExtractedFile = {
    name: file.name,
    mime: file.type,
    size: file.size,
  };
  if (file.type.startsWith('image/')) {
    result.dataUrl = await readDataUrl(file);
    return result;
  }
  if (TEXT_TYPES.test(file.type) || TEXT_EXT.test(file.name)) {
    const text = await file.text();
    result.previewText = text;
    return result;
  }
  // Unknown type — capture truncated bytes as base64 for downstream analyzers
  // and a short notice in previewText.
  result.previewText = `(Binary file ${file.name}, size=${file.size}; rich extraction not yet wired in this build.)`;
  return result;
}

function readDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result as string);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(file);
  });
}
