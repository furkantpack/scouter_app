import 'server-only';

import { waitUntil } from '@vercel/functions';

import { resolveEngineWorkerUrl } from '@/lib/engine-worker-url';

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

async function dispatchEngineWorker(request: Request) {
  const secret = process.env.CRON_SECRET;
  const target = resolveEngineWorkerUrl(request.url);
  if (!secret || !target) return false;

  const headers = new Headers({ authorization: `Bearer ${secret}` });
  const protectionBypass = process.env.VERCEL_AUTOMATION_BYPASS_SECRET;
  if (protectionBypass)
    headers.set('x-vercel-protection-bypass', protectionBypass);

  try {
    const response = await fetch(target.url, {
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
  } catch {
    console.warn('[engine-dispatch] worker request failed', {
      reason: 'request_failed',
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
  const target = resolveEngineWorkerUrl(request.url);
  if (!target) {
    console.warn('[engine-dispatch] immediate dispatch skipped', {
      reason: 'worker_url_unavailable',
      vercelUrlConfigured: Boolean(process.env.VERCEL_URL?.trim()),
      production: process.env.NODE_ENV === 'production',
    });
    return { scheduled: false, reason: 'worker_url_unavailable' };
  }
  console.info('[engine-dispatch] immediate dispatch registered', {
    target: target.source,
  });
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
