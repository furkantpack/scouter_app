const PRIVATE_HOST = /^(localhost|127\.|0\.|10\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|::1$|fc|fd)/i;

export function normalizePublicWebsite(value: string) {
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('Enter a valid website URL.'); }
  if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || PRIVATE_HOST.test(url.hostname)) {
    throw new Error('Enter a public HTTP or HTTPS website URL.');
  }
  url.hash = '';
  return url.toString().replace(/\/$/, '');
}

