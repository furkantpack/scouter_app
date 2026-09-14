import 'server-only';

import { waitUntil } from '@vercel/functions';

const WORKER_PATH = '/api/internal/engine-worker';
const DISPATCH_TIMEOUT_MS = 10_000;

export type EngineWorkerDispatchSchedule =
  | { scheduled: true }
  | {
      scheduled: false;
      reason:
        | 'cron_secret_missing'
        | 'worker_url_unavailable'
        | 'wait_until_registration_failed';
    };

function dispatchErrorReason(error: unknown) {
  return error instanceof DOMException && error.name === 'TimeoutError'
    ? 'request_timeout'
    : 'request_failed';
}

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
    if (response.status !== 202) {
      console.warn('[engine-dispatch] worker request rejected', {
        reason: 'unexpected_status',
        status: response.status,
      });
      return false;
    }
    console.info('[engine-dispatch] worker request accepted', { status: 202 });
    return true;
  } catch (error) {
    console.warn('[engine-dispatch] worker request failed', {
      reason: dispatchErrorReason(error),
    });
    return false;
  }
}

export function scheduleEngineWorkerDispatch(
  request: Request,
): EngineWorkerDispatchSchedule {
  if (!process.env.CRON_SECRET) {
    console.warn('[engine-dispatch] immediate dispatch skipped', {
      reason: 'cron_secret_missing',
    });
    return { scheduled: false, reason: 'cron_secret_missing' };
  }
  if (!workerUrl(request)) {
    console.warn('[engine-dispatch] immediate dispatch skipped', {
      reason: 'worker_url_unavailable',
      vercelUrlConfigured: Boolean(process.env.VERCEL_URL?.trim()),
      production: process.env.NODE_ENV === 'production',
    });
    return { scheduled: false, reason: 'worker_url_unavailable' };
  }
  try {
    waitUntil(dispatchEngineWorker(request));
    return { scheduled: true };
  } catch {
    console.warn('[engine-dispatch] immediate dispatch registration failed', {
      reason: 'wait_until_registration_failed',
    });
    return { scheduled: false, reason: 'wait_until_registration_failed' };
  }
}
