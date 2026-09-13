import { NextResponse } from 'next/server';

import { isShareToken, sanitizeSharedList } from '@/lib/shared-list';
import { createClient } from '@/lib/supabase/server';

export async function GET(_: Request, { params }: { params: { token: string } }) {
  if (!isShareToken(params.token))
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_shared_list', {
    p_share_token: params.token,
  });
  if (error) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  const safe = sanitizeSharedList(data);
  if (safe.length === 0)
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(safe, {
    headers: { 'Cache-Control': 'public, max-age=60, s-maxage=300' },
  });
}
