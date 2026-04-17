import { NextResponse } from 'next/server';
import { requireSession } from '../../../../lib/auth';
import { supabaseAdmin } from '../../../../lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const auth = await requireSession(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const { error } = await supabaseAdmin
    .from('affiliates')
    .update({ accepted_terms_at: new Date().toISOString() })
    .eq('id', auth.affiliate.id);
  if (error) return NextResponse.json({ error: 'update_failed', detail: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
