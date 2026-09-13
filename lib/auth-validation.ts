export function safeNext(value: string | null | undefined, fallback = '/auth/continue') {
  if (!value || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u0020]/.test(value)) return fallback;
  try {
    const url = new URL(value, 'https://scouter.invalid');
    if (url.origin !== 'https://scouter.invalid') return fallback;
    if (/^\/(?:api|auth|login|register)(?:\/|$)/.test(url.pathname)) return fallback;
    return url.pathname + url.search + url.hash;
  } catch { return fallback; }
}

export function validEmail(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export function validPassword(value: unknown): value is string {
  return typeof value === 'string' && value.length >= 8 && value.length <= 128 && /[A-Z]/.test(value) && /\d/.test(value);
}

export function validWebUrl(value: unknown): value is string {
  if (typeof value !== 'string' || value.length > 2048) return false;
  try { const url = new URL(value); return ['http:', 'https:'].includes(url.protocol) && !url.username && !url.password; }
  catch { return false; }
}
