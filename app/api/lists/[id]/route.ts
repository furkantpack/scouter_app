import {
  ApiError,
  bodyOf,
  dbError,
  uuid,
  withWorkspace,
} from '@/lib/product-api';
import { loadBestProgramFits } from '@/lib/program-fit';

const VISIBILITIES = ['private', 'organization', 'public_link'];

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  return withWorkspace(request, async ({ supabase, user, membership }) => {
    if (!uuid(params.id)) throw new ApiError('Invalid list.');
    const { data: list, error } = await supabase
      .from('lists')
      .select('*,list_founders(founder_id)')
      .eq('organization_id', membership!.organization_id)
      .eq('id', params.id)
      .maybeSingle();
    dbError(error);
    if (!list) throw new ApiError('List not found.', 404);
    if (list.visibility === 'private' && list.created_by !== user!.id)
      throw new ApiError('List not found.', 404);
    const ids = list.list_founders.map(
      (f: { founder_id: string }) => f.founder_id,
    );
    const result = ids.length
      ? await supabase
          .from('founder_product_profile')
          .select('*')
          .in('id', ids)
          .order('name')
      : { data: [], error: null };
    dbError(result.error);
    const tagResult = ids.length
      ? await supabase
          .from('founder_tags')
          .select('founder_id,tags(tag)')
          .in('founder_id', ids)
      : { data: [], error: null };
    dbError(tagResult.error);
    const bestFits = await loadBestProgramFits(supabase, ids);
    const tagsByFounder = new Map<string, string[]>();
    for (const row of tagResult.data || []) {
      const tag = (row as any).tags?.tag;
      if (typeof tag === 'string') {
        const current = tagsByFounder.get((row as any).founder_id) || [];
        current.push(tag);
        tagsByFounder.set((row as any).founder_id, current);
      }
    }
    return {
      list: {
        ...list,
        can_edit: list.created_by === user!.id,
        creator_label:
          list.created_by === user!.id
            ? String(
                user!.user_metadata?.full_name ||
                  user!.user_metadata?.name ||
                  user!.email ||
                  'You',
              )
            : 'Team member',
      },
      founders: (result.data || []).map((founder: any) => ({
        ...founder,
        signal_tags: (tagsByFounder.get(founder.id) || []).slice(0, 3),
        best_program_fit: bestFits.get(founder.id) || null,
      })),
    };
  });
}
export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  return withWorkspace(request, async ({ supabase, user, membership }) => {
    const body = await bodyOf(request);
    if (
      !uuid(params.id) ||
      typeof body.name !== 'string' ||
      !body.name.trim() ||
      body.name.length > 100 ||
      (body.description != null &&
        (typeof body.description !== 'string' ||
          body.description.length > 1000)) ||
      !VISIBILITIES.includes(String(body.visibility))
    )
      throw new ApiError('Enter valid list details.');
    const updates: any = {
      name: body.name.trim(),
      description:
        typeof body.description === 'string' && body.description.trim()
          ? body.description.trim()
          : null,
      visibility: body.visibility,
    };
    const { data: existing, error: findError } = await supabase
      .from('lists')
      .select('id,share_token')
      .eq('organization_id', membership!.organization_id)
      .eq('created_by', user!.id)
      .eq('id', params.id)
      .maybeSingle();
    dbError(findError);
    if (!existing)
      throw new ApiError('Only the list creator can edit this list.', 403);
    if (body.visibility === 'public_link' && !existing.share_token)
      updates.share_token = crypto.randomUUID();
    const { data, error } = await supabase
      .from('lists')
      .update(updates)
      .eq('organization_id', membership!.organization_id)
      .eq('created_by', user!.id)
      .eq('id', params.id)
      .select()
      .single();
    dbError(error);
    return data;
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  return withWorkspace(request, async ({ supabase, user, membership }) => {
    if (!uuid(params.id)) throw new ApiError('Invalid list.');
    const { data, error } = await supabase
      .from('lists')
      .delete()
      .eq('organization_id', membership!.organization_id)
      .eq('created_by', user!.id)
      .eq('id', params.id)
      .select('id')
      .maybeSingle();
    dbError(error);
    if (!data)
      throw new ApiError('Only the list creator can delete this list.', 403);
    return { ok: true };
  });
}
