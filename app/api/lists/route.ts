import { NextResponse } from 'next/server';

import { checkOrigin, readBody } from '@/lib/auth-request';
import { getWorkspace } from '@/lib/supabase/workspace';

export async function GET() {
  const { supabase, user, membership } = await getWorkspace();
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!membership)
    return NextResponse.json(
      { error: 'Organization required' },
      { status: 409 },
    );
  const { data, error } = await supabase
    .from('lists')
    .select('*,list_founders(founder_id)')
    .eq('organization_id', membership.organization_id)
    .or(`visibility.neq.private,created_by.eq.${user.id}`)
    .order('updated_at', { ascending: false });
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  const founderIds = Array.from(
    new Set(
      (data || []).flatMap((list: any) =>
        (list.list_founders || [])
          .slice(0, 3)
          .map((item: any) => item.founder_id),
      ),
    ),
  );
  const profiles = founderIds.length
    ? await supabase
        .from('founder_product_profile')
        .select('id,name,company_name')
        .in('id', founderIds)
    : { data: [], error: null };
  if (profiles.error)
    return NextResponse.json(
      { error: profiles.error.message },
      { status: 400 },
    );
  const byId = new Map(
    (profiles.data || []).map((profile: any) => [profile.id, profile]),
  );
  const creatorName = String(
    user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email ||
      'You',
  );
  return NextResponse.json(
    (data || []).map((list: any) => ({
      ...list,
      creator_label: list.created_by === user.id ? creatorName : 'Team member',
      can_edit: list.created_by === user.id,
      founder_preview: (list.list_founders || [])
        .slice(0, 3)
        .map((item: any) => byId.get(item.founder_id))
        .filter(Boolean),
    })),
  );
}

export async function POST(request: Request) {
  const denied = checkOrigin(request);
  if (denied) return denied;
  const body = await readBody(request);
  if (
    !body ||
    typeof body.name !== 'string' ||
    !body.name.trim() ||
    body.name.length > 100 ||
    (body.description != null &&
      (typeof body.description !== 'string' || body.description.length > 1000))
  )
    return NextResponse.json(
      { error: 'Enter a valid list name and description.' },
      { status: 400 },
    );
  const name = body.name.trim(),
    description = body.description || null,
    visibility = body.visibility || 'private';
  const { supabase, user, membership } = await getWorkspace();
  if (!user)
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  if (!membership)
    return NextResponse.json(
      { error: 'Organization required' },
      { status: 409 },
    );
  if (!['private', 'organization', 'public_link'].includes(String(visibility)))
    return NextResponse.json({ error: 'Invalid visibility' }, { status: 400 });
  const values: Record<string, unknown> = {
    organization_id: membership.organization_id,
    created_by: user.id,
    name,
    description,
    visibility,
  };
  if (visibility === 'public_link') values.share_token = crypto.randomUUID();
  const { data, error } = await supabase
    .from('lists')
    .insert(values)
    .select()
    .single();
  if (error)
    return NextResponse.json({ error: error.message }, { status: 400 });
  return NextResponse.json(data, { status: 201 });
}
