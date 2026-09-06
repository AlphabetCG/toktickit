import { randomUUID } from "node:crypto";

// 5 MB, exactly (BR-05).
export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

// Detected MIME type → canonical extension. Only these four types are permitted
// (BR-04). Detection is by file content, never the filename extension (BR-51).
const MIME_EXT: Record<string, string> = {
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/webp": ".webp",
  "application/pdf": ".pdf",
};

/** Sniff the real type from the leading bytes. Returns null for anything else. */
export function detectMimeType(buffer: Buffer): string | null {
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return "image/jpeg";
  }
  if (
    buffer.length >= 8 &&
    buffer[0] === 0x89 &&
    buffer[1] === 0x50 &&
    buffer[2] === 0x4e &&
    buffer[3] === 0x47
  ) {
    return "image/png";
  }
  if (
    buffer.length >= 12 &&
    buffer.toString("ascii", 0, 4) === "RIFF" &&
    buffer.toString("ascii", 8, 12) === "WEBP"
  ) {
    return "image/webp";
  }
  if (buffer.length >= 5 && buffer.toString("ascii", 0, 5) === "%PDF-") {
    return "application/pdf";
  }
  return null;
}

export function isPermittedMime(mime: string | null): boolean {
  return mime !== null && mime in MIME_EXT;
}

export function isWithinSizeLimit(sizeBytes: number): boolean {
  return sizeBytes <= MAX_ATTACHMENT_BYTES;
}

/**
 * Server-generated stored name: a random UUID plus the extension derived from the
 * **detected** MIME type. The client's original filename is never used as a path
 * segment, so `../../etc/passwd` in the upload cannot escape the upload directory
 * (BR-50, UNIT-05).
 */
export function generateStoredFilename(detectedMime: string): string {
  const ext = MIME_EXT[detectedMime] ?? "";
  return `${randomUUID()}${ext}`;
}
