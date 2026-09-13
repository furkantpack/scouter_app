import { withWorkspace, dbError, uuid, ApiError } from '@/lib/product-api';
import { loadFounderProgramFits } from '@/lib/program-fit';
export async function GET(request: Request, { params }: { params: { id: string } }) { return withWorkspace(request, async ({ supabase }) => {
 if (!uuid(params.id)) throw new ApiError('Invalid founder id.');
 const [profile,social,roles,tags,programFits] = await Promise.all([
 supabase.from('founder_product_profile').select('*').eq('id',params.id).maybeSingle(),
 supabase.from('founders').select('linkedin_url,twitter_url').eq('id',params.id).maybeSingle(),
 supabase.from('founder_company_roles').select('*,companies(*)').eq('founder_id',params.id),
 supabase.from('founder_tags').select('*,tags(*)').eq('founder_id',params.id),
 loadFounderProgramFits(supabase, params.id)]);
 for(const result of [profile,social,roles,tags]) dbError(result.error);
 if(!profile.data) throw new ApiError('Founder not found.',404);
 return {profile:profile.data,social:social.data,roles:roles.data||[],tags:tags.data||[],program_fits:programFits};
 }); }
