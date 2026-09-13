import { withWorkspace, dbError, bodyOf, uuid, ApiError } from '@/lib/product-api';
export async function GET(request:Request){return withWorkspace(request,async({supabase,membership})=>{
 const founderId=new URL(request.url).searchParams.get('founderId');if(!uuid(founderId))throw new ApiError('Invalid founder.');
 const {data,error}=await supabase.from('founder_notes').select('*').eq('organization_id',membership!.organization_id).eq('founder_id',founderId).order('created_at',{ascending:false});dbError(error);return data||[];
 });}
export async function POST(request:Request){return withWorkspace(request,async({supabase,membership,user})=>{
 const body=await bodyOf(request);if(!uuid(body.founderId)||typeof body.body!=='string'||!body.body.trim()||body.body.length>10000)throw new ApiError('Enter a note up to 10,000 characters.');
 const {data,error}=await supabase.from('founder_notes').insert({organization_id:membership!.organization_id,founder_id:body.founderId,user_id:user!.id,body:body.body.trim()}).select().single();dbError(error);return data;
 });}
