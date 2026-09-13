import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkOrigin, readBody } from '@/lib/auth-request';
import { validEmail, validPassword, safeNext } from '@/lib/auth-validation';
export async function POST(request: Request, { params }: { params: { action: string } }) {
  const denied = checkOrigin(request);
  if (denied) return denied;
  const body = await readBody(request);
  if (!body) return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
  const action = params.action;
  if (!['register', 'reset-password', 'resend', 'update-password'].includes(action)) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  if (action !== 'update-password' && !validEmail(body.email)) return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  if (['register', 'update-password'].includes(action) && !validPassword(body.password)) return NextResponse.json({ error: 'Use 8–128 characters including an uppercase letter and a number.' }, { status: 400 });
  if (action === 'register' && (typeof body.fullName !== 'string' || !body.fullName.trim() || body.fullName.trim().length > 100)) return NextResponse.json({ error: 'Enter your full name (up to 100 characters).' }, { status: 400 });
  try {
    const supabase = await createClient();
    const origin = new URL(request.url).origin;
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    let error;
    let signedIn = false;
    if (action === 'register') {
      const result = await supabase.auth.signUp({ email, password: body.password as string, options: { data: { full_name: (body.fullName as string).trim() }, emailRedirectTo: origin + '/auth/callback?next=' + encodeURIComponent(safeNext(typeof body.next === 'string' ? body.next : null)) } });
      error = result.error; signedIn = Boolean(result.data.session);
    } else if (action === 'reset-password') {
      ({ error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: origin + '/auth/callback?next=/update-password' }));
    } else if (action === 'resend') {
      ({ error } = await supabase.auth.resend({ type: 'signup', email, options: { emailRedirectTo: origin + '/auth/callback' } }));
    } else {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return NextResponse.json({ error: 'This reset link has expired. Request a new link.' }, { status: 401 });
      ({ error } = await supabase.auth.updateUser({ password: body.password as string }));
    }
    if (error) {
      if (error.status === 429) return NextResponse.json({ error: 'Too many attempts. Please wait before trying again.' }, { status: 429 });
      if (error.status === 0 || (error.status && error.status >= 500)) return NextResponse.json({ error: 'Authentication is temporarily unavailable. Please try again.' }, { status: 503 });
      // Do not reveal whether an email address already belongs to an account.
      if (!['reset-password', 'resend'].includes(action) && error.code !== 'user_already_exists') return NextResponse.json({ error: action === 'update-password' ? 'Password could not be changed. Use a different password or request a new link.' : 'Registration could not be completed. Check your details and try again.' }, { status: 400 });
    }
    return NextResponse.json({ ok: true, signedIn }, { headers: { 'Cache-Control': 'no-store' } });
  } catch { return NextResponse.json({ error: 'Authentication service is unreachable. Please try again.' }, { status: 503 }); }
}
