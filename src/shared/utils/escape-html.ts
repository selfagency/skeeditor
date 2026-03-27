/**
 * Escapes HTML special characters in a string to prevent XSS when interpolating
 * user-controlled data (e.g. DIDs, handles) into innerHTML templates.
 */
export function escapeHTML(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
