import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/auth';
import { supabaseAdmin } from '../../../../lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'invalid_body' }, { status: 400 });

  const affiliate_id = body.affiliate_id;
  const type = body.type;
  const title = (body.title || '').toString().trim().slice(0, 120) || null;
  const message = (body.message || '').toString().trim().slice(0, 2000);

  if (!affiliate_id || !type || !message) {
    return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
  }
  if (!['praise', 'warning', 'info'].includes(type)) {
    return NextResponse.json({ error: 'invalid_type' }, { status: 400 });
  }

  const { error: insertErr } = await supabaseAdmin
    .from('notifications')
    .insert({ affiliate_id, type, title, message });
  if (insertErr) {
    return NextResponse.json({ error: 'insert_failed', detail: insertErr.message }, { status: 500 });
  }

  let banned = false;
  let warnings_count = null;
  if (type === 'warning') {
    const { data: aff } = await supabaseAdmin
      .from('affiliates')
      .select('warnings_count')
      .eq('id', affiliate_id)
      .maybeSingle();
    warnings_count = ((aff && aff.warnings_count) || 0) + 1;
    const patch = { warnings_count };
    if (warnings_count >= 2) {
      patch.blocked = true;
      banned = true;
    }
    await supabaseAdmin.from('affiliates').update(patch).eq('id', affiliate_id);
  }

  return NextResponse.json({ ok: true, banned, warnings_count });
}
