import { withWorkspace, dbError, bodyOf, uuid, ApiError } from '@/lib/product-api';
export async function GET(request: Request) { return withWorkspace(request, async ({supabase,membership}) => {
 const {data:monitors,error} = await supabase.from('founder_monitors').select('*').eq('organization_id',membership!.organization_id).neq('status','archived'); dbError(error);
 const ids = (monitors||[]).map(m=>m.founder_id);
 const result = ids.length ? await supabase.from('founder_product_profile').select('*').in('id',ids).order('scouter_score',{ascending:false,nullsFirst:false}).order('name') : {data:[],error:null}; dbError(result.error);
 return {monitors:monitors||[],founders:result.data||[]};
 }); }
export async function POST(request: Request) { return withWorkspace(request, async ({supabase,membership,user}) => {
 const body = await bodyOf(request); if(!uuid(body.founderId)) throw new ApiError('Invalid founder.');
 const {data,error}=await supabase.from('founder_monitors').upsert({organization_id:membership!.organization_id,founder_id:body.founderId,created_by:user!.id,status:'active',priority:'normal'},{onConflict:'organization_id,founder_id'}).select().single();dbError(error);return data;
 }); }
export async function DELETE(request: Request) { return withWorkspace(request, async ({supabase,membership}) => {
 const id=new URL(request.url).searchParams.get('founderId');if(!uuid(id)) throw new ApiError('Invalid founder.');
 const {error}=await supabase.from('founder_monitors').update({status:'archived'}).eq('organization_id',membership!.organization_id).eq('founder_id',id);dbError(error);return {ok:true};
 }); }
