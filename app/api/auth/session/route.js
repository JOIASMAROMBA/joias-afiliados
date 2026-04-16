import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { getSessionFromRequest } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const session = getSessionFromRequest(request);
  if (!session?.id) {
    return NextResponse.json({ ok: false, error: 'no_session' }, { status: 401 });
  }

  const { data: affiliate } = await supabaseAdmin
    .from('affiliates')
    .select('id, name, coupon_code, is_admin, blocked')
    .eq('id', session.id)
    .maybeSingle();

  if (!affiliate || affiliate.blocked) {
    return NextResponse.json({ ok: false, error: 'invalid' }, { status: 401 });
  }

  return NextResponse.json({ ok: true, affiliate });
}
