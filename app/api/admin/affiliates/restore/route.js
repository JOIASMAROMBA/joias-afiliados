import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/auth';
import { supabaseAdmin } from '../../../../../lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  var session = await requireAdmin(request);
  if (session.error) return NextResponse.json({ error: session.error }, { status: session.status });

  var body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  var affiliateId = body && body.affiliate_id;
  if (!affiliateId) return NextResponse.json({ error: 'missing_affiliate_id' }, { status: 400 });

  var { data: target, error: fetchErr } = await supabaseAdmin
    .from('affiliates')
    .select('id, name, deleted_at')
    .eq('id', affiliateId)
    .maybeSingle();
  if (fetchErr) return NextResponse.json({ error: 'db_error', detail: fetchErr.message }, { status: 500 });
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (!target.deleted_at) return NextResponse.json({ error: 'not_deleted' }, { status: 400 });

  var { error: updErr } = await supabaseAdmin
    .from('affiliates')
    .update({ deleted_at: null, deleted_by: null, deletion_reason: null })
    .eq('id', affiliateId);

  if (updErr) return NextResponse.json({ error: 'restore_failed', detail: updErr.message }, { status: 500 });

  return NextResponse.json({ ok: true, restored_id: affiliateId, name: target.name });
}
