import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';
import InviteAcceptance from './invite-acceptance';
export default async function Invite({params}:{params:{token:string}}){const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();if(!user)redirect('/login?next='+encodeURIComponent('/invite/'+params.token));return <InviteAcceptance token={params.token} email={user.email||''}/>;}
