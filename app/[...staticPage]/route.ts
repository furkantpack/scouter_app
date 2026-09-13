import { readFile } from 'node:fs/promises';
import path from 'node:path';

import { legacyDemoRoutesEnabled } from '@/lib/legacy-demo-routes';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

type RouteContext = {
  params: {
    staticPage: string[];
  };
};

export async function GET(_: Request, { params }: RouteContext) {
  if (!legacyDemoRoutesEnabled()) {
    return new Response('Not found', {
      status: 404,
      headers: {
        'cache-control': 'no-store',
        'x-robots-tag': 'noindex, nofollow',
      },
    });
  }

  const segments = params.staticPage ?? [];

  if (
    segments.length === 0 ||
    segments.some(
      (segment) =>
        !segment ||
        segment === '.' ||
        segment === '..' ||
        segment.includes('/') ||
        segment.includes('\\'),
    )
  ) {
    return new Response('Not found', { status: 404 });
  }

  const publicRoot = path.join(process.cwd(), 'public');
  const pagePath = path.join(publicRoot, ...segments, 'index.html');

  if (!pagePath.startsWith(publicRoot + path.sep)) {
    return new Response('Not found', { status: 404 });
  }

  try {
    let html = await readFile(pagePath, 'utf8');
    const themeLink =
      '<link rel="stylesheet" href="/shared/unified-catalyst-theme.css">';

    if (!html.includes('/shared/unified-catalyst-theme.css')) {
      html = html.replace('</head>', `${themeLink}</head>`);
    }

    return new Response(html, {
      headers: {
        'content-type': 'text/html; charset=utf-8',
        'cache-control': 'no-store',
      },
    });
  } catch {
    return new Response('Not found', { status: 404 });
  }
}
