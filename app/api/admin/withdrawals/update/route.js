import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase-admin';
import { requireAdmin } from '../../../../../lib/auth';

export const dynamic = 'force-dynamic';

const ALLOWED_STATUS = ['paid', 'rejected', 'pending'];

export async function POST(request) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const body = await request.json().catch(() => ({}));
    const id = String(body?.id || '').trim();
    const status = String(body?.status || '').trim();
    if (!id || !ALLOWED_STATUS.includes(status)) {
      return NextResponse.json({ error: 'invalid_request' }, { status: 400 });
    }
    const updates = { status };
    if (status === 'paid') updates.paid_at = new Date().toISOString();
    if (body?.receipt_url) updates.receipt_url = String(body.receipt_url).slice(0, 500);
    if (body?.receipt_url) updates.receipt_sent_at = new Date().toISOString();

    const { error } = await supabaseAdmin.from('withdrawals').update(updates).eq('id', id);
    if (error) return NextResponse.json({ error: 'db_error', detail: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: 'unexpected', detail: String(err?.message || err) }, { status: 500 });
  }
}
