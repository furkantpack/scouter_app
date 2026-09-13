import { NextResponse } from 'next/server';

export function checkOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if ((origin && origin !== new URL(request.url).origin) || request.headers.get('sec-fetch-site') === 'cross-site') {
    return NextResponse.json({ error: 'Request origin is not allowed.' }, { status: 403 });
  }
  return null;
}

export async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  if (!request.headers.get('content-type')?.includes('application/json')) return null;
  const text = await request.text();
  if (text.length > 16384) return null;
  try { const data = JSON.parse(text); return data && typeof data === 'object' && !Array.isArray(data) ? data : null; }
  catch { return null; }
}
