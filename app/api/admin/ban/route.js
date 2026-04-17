import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/auth';
import { supabaseAdmin } from '../../../../lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => null);
  if (!body?.affiliate_id) return NextResponse.json({ error: 'missing_affiliate_id' }, { status: 400 });

  const unban = body.action === 'unban';
  const patch = unban ? { blocked: false, warnings_count: 0 } : { blocked: true };

  const { error } = await supabaseAdmin.from('affiliates').update(patch).eq('id', body.affiliate_id);
  if (error) return NextResponse.json({ error: 'update_failed', detail: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, blocked: !unban });
}
