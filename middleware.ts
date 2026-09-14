import { NextResponse, type NextRequest } from 'next/server';
import { createServerClient } from '@supabase/ssr';

import {
  fundedPageEnabled,
  isFundedPagePath,
} from '@/lib/funded-page-visibility';
import {
  isLegacyDemoRoute,
  legacyDemoRoutesEnabled,
} from '@/lib/legacy-demo-routes';
import {
  CANONICAL_PORTFOLIO_PATH,
  canonicalizePortfolioPath,
} from '@/lib/portfolio-route';
import { supabaseFetch } from '@/lib/supabase/fetch';

const protectedPrefixes = [
  '/add-product',
  '/all-founders',
  '/dashboard',
  '/ef',
  '/projects',
  '/monitor',
  '/network',
  '/network-mode',
  '/profile',
  CANONICAL_PORTFOLIO_PATH,
  '/exit-companies',
  '/pages',
  '/team',
  '/organization',
];

export async function middleware(request: NextRequest) {
  const canonicalPortfolioPath = canonicalizePortfolioPath(
    request.nextUrl.pathname,
  );
  if (canonicalPortfolioPath) {
    const destination = request.nextUrl.clone();
    destination.pathname = canonicalPortfolioPath;
    return NextResponse.redirect(destination, 308);
  }

  if (isFundedPagePath(request.nextUrl.pathname) && !fundedPageEnabled()) {
    return new NextResponse('Not found', {
      status: 404,
      headers: {
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  }

  if (
    request.nextUrl.pathname === '/thesis' ||
    request.nextUrl.pathname.startsWith('/thesis/')
  ) {
    return new NextResponse('Not found', {
      status: 404,
      headers: {
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  }

  if (
    !legacyDemoRoutesEnabled() &&
    isLegacyDemoRoute(request.nextUrl.pathname)
  ) {
    return new NextResponse('Not found', {
      status: 404,
      headers: {
        'Cache-Control': 'no-store',
        'X-Robots-Tag': 'noindex, nofollow',
      },
    });
  }

  if (
    request.nextUrl.pathname.startsWith('/api/') ||
    request.nextUrl.pathname.startsWith('/auth/')
  )
    return NextResponse.next();

  const isProtected = protectedPrefixes.some((prefix) =>
    request.nextUrl.pathname.startsWith(prefix),
  );

  // Public pages must stay available even when the auth service is slow or
  // temporarily unreachable. Authentication is checked again by protected
  // routes and by /auth/continue before entering a workspace.
  if (!isProtected) return NextResponse.next();

  let response = NextResponse.next({ request });
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      global: { fetch: supabaseFetch },
      cookies: {
        getAll: () => request.cookies.getAll(),
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    loginUrl.search = '';
    loginUrl.searchParams.set(
      'next',
      request.nextUrl.pathname + request.nextUrl.search,
    );
    const redirect = NextResponse.redirect(loginUrl);
    response.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
    redirect.headers.set('Cache-Control', 'no-store');
    return redirect;
  }

  return response;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|images|icons|flags).*)'],
};
