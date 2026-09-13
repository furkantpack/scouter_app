import 'server-only';

import { waitUntil } from '@vercel/functions';

const WORKER_PATH = '/api/internal/engine-worker';
const DISPATCH_TIMEOUT_MS = 10_000;

function workerUrl(request: Request) {
  const deploymentHost = process.env.VERCEL_URL?.trim();
  if (deploymentHost) {
    if (!/^[a-z0-9.-]+$/i.test(deploymentHost)) return null;
    try {
      return new URL(WORKER_PATH, `https://${deploymentHost}`).toString();
    } catch {
      return null;
    }
  }

  if (process.env.NODE_ENV !== 'production') {
    const requestUrl = new URL(request.url);
    if (['localhost', '127.0.0.1', '[::1]'].includes(requestUrl.hostname))
      return new URL(WORKER_PATH, requestUrl.origin).toString();
  }

  return null;
}

async function dispatchEngineWorker(request: Request) {
  const secret = process.env.CRON_SECRET;
  const url = workerUrl(request);
  if (!secret || !url) return false;

  const headers = new Headers({ authorization: `Bearer ${secret}` });
  const protectionBypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (protectionBypass)
    headers.set('x-vercel-protection-bypass', protectionBypass);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      cache: 'no-store',
      signal: AbortSignal.timeout(DISPATCH_TIMEOUT_MS),
    });
    return response.status === 202;
  } catch {
    return false;
  }
}

export function scheduleEngineWorkerDispatch(request: Request) {
  if (!process.env.CRON_SECRET || !workerUrl(request)) return false;
  waitUntil(dispatchEngineWorker(request));
  return true;
}
