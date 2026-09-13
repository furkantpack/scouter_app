import { NextResponse } from 'next/server';

import { checkOrigin, readBody } from '@/lib/auth-request';
import { validWebUrl } from '@/lib/auth-validation';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const denied = checkOrigin(request); if (denied) return denied;
  const body = await readBody(request);
  if (!body || typeof body.name !== 'string' || typeof body.slug !== 'string' || body.name.trim().length > 100 || body.slug.length > 120 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(body.slug) || (body.websiteUrl != null && body.websiteUrl !== '' && !validWebUrl(body.websiteUrl))) return NextResponse.json({ error: 'Enter a valid organization name, slug and website.' }, { status: 400 });
  const name = body.name as string, slug = body.slug as string, websiteUrl = body.websiteUrl as string | null;
  if (!name?.trim() || !slug?.trim()) {
    return NextResponse.json({ error: 'Name and slug are required.' }, { status: 400 });
  }

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data, error } = await supabase.rpc('create_organization', {
    p_name: name.trim(),
    p_slug: slug.trim(),
    p_website_url: websiteUrl?.trim() || null,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  const organizationId = typeof data === 'string' ? data : data?.id ?? data?.organization_id;
  const response = NextResponse.json({ organizationId, data });
  if (organizationId) response.cookies.set('scouter_active_organization', organizationId, {
    httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/',
  });
  return response;
}
