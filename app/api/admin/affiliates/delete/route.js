import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/auth';
import { supabaseAdmin } from '../../../../../lib/supabase-admin';

export const dynamic = 'force-dynamic';

const RELATED_TABLES = [
  'sales',
  'withdrawals',
  'posts',
  'posting_obligations',
  'push_subscriptions',
  'notifications',
  'audit_log',
  'bonuses',
];

export async function POST(request) {
  var session = await requireAdmin(request);
  if (session.error) return NextResponse.json({ error: session.error }, { status: session.status });

  var body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  var affiliateId = body && body.affiliate_id;
  if (!affiliateId) return NextResponse.json({ error: 'missing_affiliate_id' }, { status: 400 });

  if (affiliateId === session.affiliate.id) {
    return NextResponse.json({ error: 'cannot_delete_self' }, { status: 400 });
  }

  var { data: target, error: fetchErr } = await supabaseAdmin
    .from('affiliates')
    .select('id, name, is_admin')
    .eq('id', affiliateId)
    .maybeSingle();
  if (fetchErr) return NextResponse.json({ error: 'db_error', detail: fetchErr.message }, { status: 500 });
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (target.is_admin) return NextResponse.json({ error: 'cannot_delete_admin' }, { status: 403 });

  var warnings = [];
  for (var i = 0; i < RELATED_TABLES.length; i++) {
    var t = RELATED_TABLES[i];
    try {
      var { error } = await supabaseAdmin.from(t).delete().eq('affiliate_id', affiliateId);
      if (error && error.code !== 'PGRST116' && !/does not exist|column .* does not exist/i.test(error.message || '')) {
        warnings.push({ table: t, message: error.message });
      }
    } catch (e) {
      warnings.push({ table: t, message: String(e && e.message || e) });
    }
  }

  var { error: delErr } = await supabaseAdmin.from('affiliates').delete().eq('id', affiliateId);
  if (delErr) return NextResponse.json({ error: 'delete_failed', detail: delErr.message, warnings: warnings }, { status: 500 });

  return NextResponse.json({ ok: true, deleted_id: affiliateId, name: target.name, warnings: warnings });
}
