import { NextResponse } from 'next/server';

import { safeNext } from '@/lib/auth-validation';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get('code');
  const next = safeNext(url.searchParams.get('next'), '/dashboard');

  try {
    if (code) {
      const supabase = await createClient();
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (!error) {
        const destination =
          next === '/update-password'
            ? next
            : `/auth/continue?next=${encodeURIComponent(next)}`;
        return NextResponse.redirect(new URL(destination, url.origin));
      }
    }
  } catch {
    /* Invalid or unavailable confirmation service. */
  }
  return NextResponse.redirect(
    new URL('/login?error=confirmation', url.origin),
  );
}
