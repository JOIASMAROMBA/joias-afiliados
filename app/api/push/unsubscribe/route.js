import { NextResponse } from 'next/server';
import { requireSession } from '../../../../lib/auth';
import { supabaseAdmin } from '../../../../lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  var session = await requireSession(request);
  if (session.error) return NextResponse.json({ error: session.error }, { status: session.status });

  var body;
  try { body = await request.json(); } catch { body = {}; }
  var endpoint = body && body.endpoint;

  if (!endpoint) return NextResponse.json({ error: 'missing_endpoint' }, { status: 400 });

  var { error } = await supabaseAdmin
    .from('push_subscriptions')
    .delete()
    .eq('affiliate_id', session.affiliate.id)
    .eq('endpoint', endpoint);

  if (error) return NextResponse.json({ error: 'db_error', detail: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
