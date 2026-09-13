import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { validEmail } from '@/lib/auth-validation';
import { checkOrigin, readBody } from '@/lib/auth-request';
export async function POST(request: Request) {
  const denied = checkOrigin(request);
  if (denied) return denied;
  const body = await readBody(request);
  if (!body || !validEmail(body.email) || typeof body.password !== 'string' || !body.password || body.password.length > 128) {
    return NextResponse.json({ error: 'Enter a valid email and password.' }, { status: 400 });
  }
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.signInWithPassword({ email: body.email.trim(), password: body.password });
    if (error) {
      const status = error.status === 429 ? 429 : (error.status === 0 || (error.status && error.status >= 500)) ? 503 : 401;
      const message = status === 429 ? 'Too many attempts. Please wait before trying again.' : status === 503 ? 'Sign-in is temporarily unavailable. Please try again.' : error.code === 'email_not_confirmed' ? 'Confirm your email before signing in.' : 'Email or password is incorrect.';
      return NextResponse.json({ error: message }, { status });
    }
    if (!data.session || !data.user) return NextResponse.json({ error: 'Sign-in could not be completed.' }, { status: 401 });
    return NextResponse.json({ ok: true }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json({ error: 'Sign-in service is unreachable. Please try again.' }, { status: 503 });
  }
}
