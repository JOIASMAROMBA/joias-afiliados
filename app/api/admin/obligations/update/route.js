import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase-admin';
import { requireAdmin } from '../../../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const body = await request.json().catch(() => ({}));

    const action = String(body?.action || '').trim();
    const affiliateId = String(body?.affiliate_id || '').trim();
    if (!affiliateId) return NextResponse.json({ error: 'missing_affiliate_id' }, { status: 400 });

    if (action === 'toggle-recurring') {
      const weekday = Number(body?.weekday);
      if (!Number.isInteger(weekday) || weekday < 0 || weekday > 6) {
        return NextResponse.json({ error: 'invalid_weekday' }, { status: 400 });
      }
      const existing = await supabaseAdmin.from('posting_obligations').select('id').eq('affiliate_id', affiliateId).eq('obligation_type', 'recurring').eq('weekday', weekday).eq('active', true).maybeSingle();
      if (existing.data) {
        await supabaseAdmin.from('posting_obligations').delete().eq('id', existing.data.id);
      } else {
        await supabaseAdmin.from('posting_obligations').insert({ affiliate_id: affiliateId, obligation_type: 'recurring', weekday, active: true });
      }
      return NextResponse.json({ ok: true });
    }

    if (action === 'toggle-specific') {
      const dateStr = String(body?.date || '').trim();
      if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
        return NextResponse.json({ error: 'invalid_date' }, { status: 400 });
      }
      const existing = await supabaseAdmin.from('posting_obligations').select('id').eq('affiliate_id', affiliateId).eq('obligation_type', 'specific').eq('specific_date', dateStr).eq('active', true).maybeSingle();
      if (existing.data) {
        await supabaseAdmin.from('posting_obligations').delete().eq('id', existing.data.id);
      } else {
        await supabaseAdmin.from('posting_obligations').insert({ affiliate_id: affiliateId, obligation_type: 'specific', specific_date: dateStr, active: true });
      }
      return NextResponse.json({ ok: true });
    }

    if (action === 'clear') {
      const { error } = await supabaseAdmin.from('posting_obligations').delete().eq('affiliate_id', affiliateId);
      if (error) return NextResponse.json({ error: 'db_error', detail: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: 'unexpected', detail: String(err?.message || err) }, { status: 500 });
  }
}
