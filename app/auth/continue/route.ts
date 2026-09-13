import { NextResponse } from 'next/server';
import { getWorkspace } from '@/lib/supabase/workspace';
import { safeNext } from '@/lib/auth-validation';
export async function GET(request: Request) {
  try {
    const { supabase, user, membership } = await getWorkspace();
    if (!user) return NextResponse.redirect(new URL('/login', request.url));
    let destination = '/add-product';
    if (membership) {
      const { data, error } = await supabase.from('organization_onboarding').select('status').eq('organization_id', membership.organization_id).maybeSingle();
      if (error) throw error;
      if (data?.status === 'completed') destination = safeNext(new URL(request.url).searchParams.get('next'), '/dashboard');
    }
    const response = NextResponse.redirect(new URL(destination, request.url));
    response.headers.set('Cache-Control', 'no-store');
    if (membership) response.cookies.set('scouter_active_organization', membership.organization_id, {
      httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/',
    });
    return response;
  } catch { return NextResponse.redirect(new URL('/login?error=service', request.url)); }
}
