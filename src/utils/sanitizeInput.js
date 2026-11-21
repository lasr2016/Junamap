export function sanitizeInput(str) {
  if (!str) return "";
  return String(str)
    .replace(/<[^>]*>?/gm, "")
    .trim();
}
