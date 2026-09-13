import { NextResponse } from 'next/server';

import { checkOrigin } from '@/lib/auth-request';
import { createClient } from '@/lib/supabase/server';

export async function POST(request: Request) {
  const denied = checkOrigin(request); if (denied) return denied;
  const supabase = await createClient();
  await supabase.auth.signOut();
  const response = NextResponse.redirect(new URL('/login', request.url), 303);
  response.cookies.delete('scouter_active_organization');
  return response;
}
