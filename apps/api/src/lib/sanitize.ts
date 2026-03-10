/**
 * Sanitize text from web sources for safe display.
 * Removes control characters, BOM markers, and normalizes whitespace.
 */
export function sanitizeText(text: string): string {
  return text
    // Remove BOM
    .replace(/\uFEFF/g, "")
    // Remove control characters (except newline, tab, carriage return)
    // eslint-disable-next-line no-control-regex
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, "")
    // Decode common HTML entities
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    // Normalize whitespace (collapse multiple spaces/tabs on same line)
    .replace(/[^\S\n]+/g, " ")
    // Collapse 3+ consecutive newlines into 2
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}
