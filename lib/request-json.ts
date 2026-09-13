export type RequestJsonInit = RequestInit & {
  requestIdentity?: string;
};

const inFlightGets = new Map<string, Promise<unknown>>();

async function performRequest<T>(url: string, init: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);
  try {
    const response = await fetch(url, {
      ...init,
      signal: controller.signal,
      cache: 'no-store',
    });
    const result = await response.json().catch(() => null);
    if (!response.ok)
      throw new Error(
        result?.message ||
          result?.error ||
          (response.status === 401
            ? 'Your session expired. Please sign in again.'
            : 'The request failed. Please try again.'),
      );
    if (!result) throw new Error('Invalid server response. Please try again.');
    return result;
  } catch (error) {
    if (controller.signal.aborted)
      throw new Error('The request timed out. Please try again.');
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

export function requestJson<T = any>(
  url: string,
  init: RequestJsonInit = {},
): Promise<T> {
  const { requestIdentity, ...requestInit } = init;
  const method = (requestInit.method || 'GET').toUpperCase();
  if (method !== 'GET' || !requestIdentity)
    return performRequest<T>(url, requestInit);

  const key = `${requestIdentity}:${url}`;
  const existing = inFlightGets.get(key);
  if (existing) return existing as Promise<T>;

  const request = performRequest<T>(url, requestInit);
  inFlightGets.set(key, request);
  const remove = () => {
    if (inFlightGets.get(key) === request) inFlightGets.delete(key);
  };
  void request.then(remove, remove);
  return request;
}
