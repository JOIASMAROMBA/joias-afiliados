import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { getClientIp, checkRateLimit, logAttempt } from '../../../../lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const ip = getClientIp(request);
    const rl = await checkRateLimit({ ip, coupon: null });
    if (rl.blocked) {
      return NextResponse.json({ error: 'rate_limited', retry_in: rl.retry_in }, { status: 429 });
    }

    let body;
    try { body = await request.json(); } catch { return NextResponse.json({ error: 'invalid_body' }, { status: 400 }); }

    const coupon = String(body?.coupon || '').trim().toUpperCase();
    const email = String(body?.email || '').trim().toLowerCase();

    if (!coupon || !email) return NextResponse.json({ error: 'missing_fields' }, { status: 400 });

    const { data: affiliate } = await supabaseAdmin
      .from('affiliates')
      .select('id, email, coupon_code')
      .ilike('coupon_code', coupon)
      .maybeSingle();

    if (!affiliate || String(affiliate.email || '').toLowerCase() !== email) {
      await logAttempt({ ip, coupon, success: false });
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    await supabaseAdmin.from('password_resets').insert({
      affiliate_id: affiliate.id,
      requested_email: email,
      ip,
      status: 'pending',
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: 'unexpected', detail: String(err?.message || err) }, { status: 500 });
  }
}
