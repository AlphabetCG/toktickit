export const MAX_ATTACHMENT_BYTES = 5 * 1024 * 1024;

const ALLOWED_MIME = ["image/jpeg", "image/png", "image/webp", "application/pdf"];

// Client-side pre-check to give fast feedback (BR-42). The server re-validates by
// file content (BR-51), so this is convenience, not the security boundary.
export function validateFile(file: File): string | undefined {
  if (!ALLOWED_MIME.includes(file.type)) {
    return "Unsupported file type. Allowed: JPG, PNG, WEBP, PDF.";
  }
  if (file.size > MAX_ATTACHMENT_BYTES) {
    return "File exceeds the 5 MB limit.";
  }
  return undefined;
}
