import { cookies } from 'next/headers';

import { createClient } from './server';

export async function getWorkspace() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null, membership: null };

  const cookieStore = await cookies();
  const requestedId = cookieStore.get('scouter_active_organization')?.value;
  let query = supabase
    .from('organization_members')
    .select('organization_id,role,job_title,status')
    .eq('user_id', user.id)
    .eq('status', 'active');
  if (requestedId) query = query.eq('organization_id', requestedId);
  const { data, error } = await query.limit(1).maybeSingle();
  if (error) throw new Error("Workspace could not be loaded.");

  if (data || !requestedId) return { supabase, user, membership: data };
  const { data: fallback, error: fallbackError } = await supabase
    .from('organization_members')
    .select('organization_id,role,job_title,status')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  if (fallbackError) throw new Error("Workspace could not be loaded.");
  return { supabase, user, membership: fallback };
}
