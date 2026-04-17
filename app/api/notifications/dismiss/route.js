import { NextResponse } from 'next/server';
import { requireSession } from '../../../../lib/auth';
import { supabaseAdmin } from '../../../../lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const auth = await requireSession(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const body = await request.json().catch(() => null);
  if (!body?.id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });
  const { error } = await supabaseAdmin
    .from('notifications')
    .update({ read_at: new Date().toISOString() })
    .eq('id', body.id)
    .eq('affiliate_id', auth.affiliate.id);
  if (error) return NextResponse.json({ error: 'update_failed', detail: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
