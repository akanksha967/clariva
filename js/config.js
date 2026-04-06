/**
 * API origin for server routes (leads, call logs). No trailing slash.
 * - Same-site Vercel: leave unset or '' so requests go to /api/* on this domain.
 * - Separate API server: set window.CLARIVA_API_BASE = 'http://localhost:3000' in index.html.
 */
export function getApiBase() {
  if (typeof window === 'undefined') return '';
  const b = window.CLARIVA_API_BASE;
  if (b === undefined || b === null || String(b).trim() === '') return '';
  return String(b).replace(/\/$/, '');
}
