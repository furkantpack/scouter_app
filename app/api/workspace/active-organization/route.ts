import { NextResponse } from 'next/server';

import { checkOrigin, readBody } from '@/lib/auth-request';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const denied = checkOrigin(request); if (denied) return denied;
  const body = await readBody(request);
  if (!body || typeof body.organizationId !== 'string' || !/^[0-9a-f-]{36}$/i.test(body.organizationId)) return NextResponse.json({ error: 'Invalid organization.' }, { status: 400 });
  const organizationId = body.organizationId;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .eq('organization_id', organizationId)
    .eq('status', 'active')
    .maybeSingle();
  if (!membership) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const response = NextResponse.json({ ok: true });
  response.cookies.set('scouter_active_organization', organizationId, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
  });
  return response;
}
