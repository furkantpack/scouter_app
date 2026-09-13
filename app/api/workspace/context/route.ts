import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

import { createClient } from '@/lib/supabase/server';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ user: null }, { status: 401 });

  const [{ data: profile, error: profileError }, { data: memberships, error: membershipsError }] = await Promise.all([
    supabase.from('profiles').select('*').eq('id', user.id).maybeSingle(),
    supabase
      .from('organization_members')
      .select('organization_id,role,job_title,status,organization:organizations(*)')
      .eq('user_id', user.id)
      .eq('status', 'active'),
  ]);

  if (profileError || membershipsError) return NextResponse.json({error:'Workspace could not be loaded.'},{status:503});
  const cookieStore = await cookies();
  const requestedId = cookieStore.get('scouter_active_organization')?.value;
  const membership =
    memberships?.find((item) => item.organization_id === requestedId) ??
    memberships?.[0] ??
    null;

  return NextResponse.json({ user, profile, membership, memberships });
}
