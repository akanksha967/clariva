/**
 * Runtime config for production APIs (set on window before modules load — see index.html).
 * No secrets here: only origins and optional public SDK identifiers.
 */

export function getApiBase() {
  if (typeof window === 'undefined') return '';
  const base = window.CLARIVA_API_BASE;
  if (!base || typeof base !== 'string') return '';
  return base.replace(/\/$/, '');
}
