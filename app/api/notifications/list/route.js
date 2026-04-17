import { NextResponse } from 'next/server';
import { requireSession } from '../../../../lib/auth';
import { supabaseAdmin } from '../../../../lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  const auth = await requireSession(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { data, error } = await supabaseAdmin
    .from('notifications')
    .select('*')
    .eq('affiliate_id', auth.affiliate.id)
    .is('read_at', null)
    .order('created_at', { ascending: true });
  if (error) return NextResponse.json({ error: 'query_failed', detail: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, notifications: data || [] });
}
