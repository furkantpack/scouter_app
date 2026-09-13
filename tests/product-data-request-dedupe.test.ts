import assert from 'node:assert/strict';
import test from 'node:test';

import { requestJson } from '../lib/request-json.ts';

function jsonResponse(value: unknown) {
  return new Response(JSON.stringify(value), {
    headers: { 'content-type': 'application/json' },
  });
}

test('same active GET and request identity share one network request', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  let resolve!: (response: Response) => void;
  globalThis.fetch = (() => {
    calls += 1;
    return new Promise<Response>((done) => {
      resolve = done;
    });
  }) as typeof fetch;
  try {
    const first = requestJson('/api/lists/example', {
      requestIdentity: 'product:0',
    });
    const second = requestJson('/api/lists/example', {
      requestIdentity: 'product:0',
    });
    assert.strictEqual(first, second);
    assert.equal(calls, 1);
    resolve(jsonResponse({ ok: true }));
    assert.deepEqual(await first, { ok: true });
    assert.deepEqual(await second, { ok: true });
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('resolved GETs leave the in-flight map', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return jsonResponse({ call: calls });
  }) as typeof fetch;
  try {
    assert.deepEqual(
      await requestJson('/api/resolved', { requestIdentity: 'product:0' }),
      { call: 1 },
    );
    assert.deepEqual(
      await requestJson('/api/resolved', { requestIdentity: 'product:0' }),
      { call: 2 },
    );
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('rejected GETs leave the in-flight map so a later retry can run', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    if (calls === 1) throw new Error('temporary failure');
    return jsonResponse({ recovered: true });
  }) as typeof fetch;
  try {
    await assert.rejects(
      requestJson('/api/retryable', { requestIdentity: 'product:0' }),
      /temporary failure/,
    );
    await new Promise((resolve) => setTimeout(resolve, 0));
    assert.deepEqual(
      await requestJson('/api/retryable', { requestIdentity: 'product:0' }),
      { recovered: true },
    );
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('mutations are never deduplicated', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return jsonResponse({ ok: true });
  }) as typeof fetch;
  try {
    await Promise.all([
      requestJson('/api/lists', {
        method: 'POST',
        body: '{}',
        requestIdentity: 'product:0',
      }),
      requestJson('/api/lists', {
        method: 'POST',
        body: '{}',
        requestIdentity: 'product:0',
      }),
    ]);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('GETs without an explicit request identity are not merged', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return jsonResponse({ ok: true });
  }) as typeof fetch;
  try {
    await Promise.all([
      requestJson('/api/session-sensitive'),
      requestJson('/api/session-sensitive'),
    ]);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test('different organization scopes do not share a GET', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls += 1;
    return jsonResponse({ call: calls });
  }) as typeof fetch;
  try {
    await Promise.all([
      requestJson('/api/lists', { requestIdentity: 'product:1' }),
      requestJson('/api/lists', { requestIdentity: 'product:2' }),
    ]);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
