import { withWorkspace, dbError, bodyOf, ApiError } from '@/lib/product-api';
import { validEmail } from '@/lib/auth-validation';
export async function POST(request:Request){return withWorkspace(request,async({supabase,membership,user})=>{
 const body=await bodyOf(request);const role=membership!.role;
 const allowed=role==='owner'?['admin','member','viewer']:role==='admin'?['member','viewer']:[];
 if(!allowed.includes(String(body.role)))throw new ApiError('Your role cannot issue this invitation.',403);
 if(!validEmail(body.email))throw new ApiError('Enter a valid email.');
 const {data,error}=await supabase.from('organization_invites').insert({organization_id:membership!.organization_id,email:body.email.trim().toLowerCase(),role:body.role,invited_by:user!.id}).select('id,token,email,role').single();dbError(error);if(!data)throw new ApiError("Invitation could not be created.");
 return {...data,inviteUrl:new URL('/invite/'+encodeURIComponent(data.token),request.url).href};
 });}
