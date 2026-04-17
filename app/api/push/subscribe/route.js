import { NextResponse } from 'next/server';
import { requireSession } from '../../../../lib/auth';
import { supabaseAdmin } from '../../../../lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  var session = await requireSession(request);
  if (session.error) return NextResponse.json({ error: session.error }, { status: session.status });

  var body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  var sub = body && body.subscription;
  if (!sub || !sub.endpoint || !sub.keys || !sub.keys.p256dh || !sub.keys.auth) {
    return NextResponse.json({ error: 'invalid_subscription' }, { status: 400 });
  }

  var payload = {
    affiliate_id: session.affiliate.id,
    endpoint: sub.endpoint,
    p256dh: sub.keys.p256dh,
    auth: sub.keys.auth,
    user_agent: (body.userAgent || '').slice(0, 200) || null,
  };

  var { error } = await supabaseAdmin
    .from('push_subscriptions')
    .upsert(payload, { onConflict: 'endpoint' });

  if (error) return NextResponse.json({ error: 'db_error', detail: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
