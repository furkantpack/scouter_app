// Bound upstream requests so an unreachable auth service cannot leave forms spinning.
export const supabaseFetch: typeof fetch = (input, init) => fetch(input, {
  ...init,
  signal: init?.signal ? AbortSignal.any([init.signal, AbortSignal.timeout(10000)]) : AbortSignal.timeout(10000),
  cache: 'no-store',
});
