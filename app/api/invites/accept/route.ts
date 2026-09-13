import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { checkOrigin } from '@/lib/auth-request';
import { bodyOf, dbError, ApiError } from '@/lib/product-api';
export async function POST(request:Request){
 const denied=checkOrigin(request);if(denied)return denied;
 try {const body=await bodyOf(request);if(typeof body.token!=='string'||!body.token||body.token.length>512)throw new ApiError('Invalid invitation.');
 const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)throw new ApiError('Sign in to accept this invitation.',401);
 const {data,error}=await supabase.rpc('accept_organization_invite',{p_token:body.token});dbError(error);
 return NextResponse.json({ok:true,result:data});
 }catch(error){return NextResponse.json({error:error instanceof ApiError?error.message:'Invitation could not be accepted.'},{status:error instanceof ApiError?error.status:503});}
}
