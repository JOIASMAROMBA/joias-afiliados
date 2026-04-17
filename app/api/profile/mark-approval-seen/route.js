import { NextResponse } from 'next/server';
import { requireSession } from '../../../../lib/auth';
import { supabaseAdmin } from '../../../../lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  var session = await requireSession(request);
  if (session.error) return NextResponse.json({ error: session.error }, { status: session.status });

  var { error } = await supabaseAdmin
    .from('affiliates')
    .update({ approval_seen_at: new Date().toISOString() })
    .eq('id', session.affiliate.id);

  if (error) return NextResponse.json({ error: 'db_error', detail: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
