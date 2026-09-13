import { withWorkspace, dbError, bodyOf, uuid, ApiError } from '@/lib/product-api';
export async function PATCH(request:Request,{params}:{params:{id:string}}){return withWorkspace(request,async({supabase,membership})=>{
 const body=await bodyOf(request);if(!uuid(params.id)||typeof body.body!=='string'||!body.body.trim()||body.body.length>10000)throw new ApiError('Enter a note up to 10,000 characters.');
 const {data,error}=await supabase.from('founder_notes').update({body:body.body.trim(),updated_at:new Date().toISOString()}).eq('organization_id',membership!.organization_id).eq('id',params.id).select().single();dbError(error);return data;
 });}
export async function DELETE(request:Request,{params}:{params:{id:string}}){return withWorkspace(request,async({supabase,membership})=>{
 if(!uuid(params.id))throw new ApiError('Invalid note.');
 const {data,error}=await supabase.from('founder_notes').delete().eq('organization_id',membership!.organization_id).eq('id',params.id).select('id');dbError(error);if(!data?.length)throw new ApiError('Note not found or deletion is not permitted.',403);return {ok:true};
 });}
