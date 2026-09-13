import {
  ApiError,
  bodyOf,
  dbError,
  uuid,
  withWorkspace,
} from '@/lib/product-api';

async function requireList(
  supabase: any,
  organizationId: string,
  userId: string,
  listId: string,
) {
  if (!uuid(listId)) throw new ApiError('Invalid list.');
  const { data, error } = await supabase
    .from('lists')
    .select('id,created_by')
    .eq('id', listId)
    .eq('organization_id', organizationId)
    .maybeSingle();
  dbError(error);
  if (!data) throw new ApiError('List not found.', 404);
  if (data.created_by !== userId)
    throw new ApiError('Only the list creator can change its founders.', 403);
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  return withWorkspace(request, async ({ supabase, user, membership }) => {
    const body = await bodyOf(request);
    if (!uuid(body.founderId)) throw new ApiError('Invalid founder.');
    await requireList(
      supabase,
      membership!.organization_id,
      user!.id,
      params.id,
    );
    const { error } = await supabase.from('list_founders').upsert(
      {
        list_id: params.id,
        founder_id: body.founderId,
        added_by: user!.id,
      },
      { onConflict: 'list_id,founder_id' },
    );
    dbError(error);
    return { ok: true };
  });
}

export async function DELETE(
  request: Request,
  { params }: { params: { id: string } },
) {
  return withWorkspace(request, async ({ supabase, user, membership }) => {
    const founderId = new URL(request.url).searchParams.get('founderId');
    if (!uuid(founderId)) throw new ApiError('Invalid founder.');
    await requireList(
      supabase,
      membership!.organization_id,
      user!.id,
      params.id,
    );
    const { error } = await supabase
      .from('list_founders')
      .delete()
      .eq('list_id', params.id)
      .eq('founder_id', founderId);
    dbError(error);
    return { ok: true };
  });
}
