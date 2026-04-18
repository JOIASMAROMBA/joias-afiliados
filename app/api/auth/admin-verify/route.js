import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { signSession, COOKIE_NAME, SESSION_MAX_AGE } from '../../../../lib/auth';
import { getClientIp, checkRateLimit, logAttempt } from '../../../../lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  const ip = getClientIp(request);
  try {
    const body = await request.json().catch(function() { return {}; });
    const coupon = String(body?.coupon || '').trim();
    const code = String(body?.code || '').trim();

    if (!coupon || !code) return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
    if (!/^\d{6}$/.test(code)) return NextResponse.json({ error: 'invalid_code' }, { status: 400 });

    const rateLimit = await checkRateLimit({ ip, coupon });
    if (rateLimit.blocked) {
      return NextResponse.json({ error: 'rate_limited', reason: rateLimit.reason, retry_in: rateLimit.retry_in }, { status: 429 });
    }

    const { data: affiliate } = await supabaseAdmin
      .from('affiliates')
      .select('id, name, coupon_code, is_admin, blocked, deleted_at')
      .ilike('coupon_code', coupon)
      .maybeSingle();

    if (!affiliate || !affiliate.is_admin || affiliate.blocked || affiliate.deleted_at) {
      await logAttempt({ ip, coupon, success: false });
      return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
    }

    const codeRes = await supabaseAdmin
      .from('admin_login_codes')
      .select('*')
      .eq('affiliate_id', affiliate.id)
      .is('used_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const codeRow = codeRes.data;

    if (!codeRow) {
      await logAttempt({ ip, coupon, success: false });
      return NextResponse.json({ error: 'no_active_code' }, { status: 400 });
    }
    if (new Date(codeRow.expires_at).getTime() < Date.now()) {
      await logAttempt({ ip, coupon, success: false });
      return NextResponse.json({ error: 'code_expired' }, { status: 400 });
    }
    if ((codeRow.attempts || 0) >= 5) {
      await logAttempt({ ip, coupon, success: false });
      return NextResponse.json({ error: 'too_many_attempts' }, { status: 400 });
    }
    if (codeRow.code !== code) {
      await supabaseAdmin.from('admin_login_codes').update({ attempts: (codeRow.attempts || 0) + 1 }).eq('id', codeRow.id);
      await logAttempt({ ip, coupon, success: false });
      return NextResponse.json({ error: 'wrong_code' }, { status: 400 });
    }

    await supabaseAdmin.from('admin_login_codes').update({ used_at: new Date().toISOString() }).eq('id', codeRow.id);
    await logAttempt({ ip, coupon, success: true });

    const token = signSession({ id: affiliate.id, coupon: affiliate.coupon_code, is_admin: true });
    const res = NextResponse.json({
      ok: true,
      affiliate: { id: affiliate.id, name: affiliate.name, coupon_code: affiliate.coupon_code, is_admin: true },
    });
    res.cookies.set(COOKIE_NAME, token, { httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: SESSION_MAX_AGE });
    return res;
  } catch (err) {
    return NextResponse.json({ error: 'unexpected', detail: String(err && err.message || err) }, { status: 500 });
  }
}
