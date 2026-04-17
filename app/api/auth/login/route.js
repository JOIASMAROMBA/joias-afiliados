import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { hashPassword, verifyPassword, signSession, COOKIE_NAME, SESSION_MAX_AGE } from '../../../../lib/auth';
import { getClientIp, checkRateLimit, logAttempt } from '../../../../lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    if (!process.env.AUTH_JWT_SECRET || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'server_misconfigured', detail: 'missing env vars on server' }, { status: 500 });
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'invalid_body' }, { status: 400 });
    }

    const coupon = String(body?.coupon || '').trim();
    const password = String(body?.password || '').trim();

    if (!coupon || !password) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
    }

    const ip = getClientIp(request);
    const rateLimit = await checkRateLimit({ ip, coupon });
    if (rateLimit.blocked) {
      return NextResponse.json({
        error: 'rate_limited',
        reason: rateLimit.reason,
        retry_in: rateLimit.retry_in,
      }, { status: 429 });
    }

    const { data: affiliate, error } = await supabaseAdmin
      .from('affiliates')
      .select('id, name, coupon_code, password_hash, is_admin, blocked, deleted_at')
      .ilike('coupon_code', coupon)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: 'db_error', detail: error.message }, { status: 500 });
    }
    if (!affiliate) {
      await logAttempt({ ip, coupon, success: false });
      return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
    }
    if (affiliate.deleted_at) {
      await logAttempt({ ip, coupon, success: false });
      return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
    }
    if (affiliate.blocked) {
      await logAttempt({ ip, coupon, success: false });
      return NextResponse.json({ error: 'blocked' }, { status: 403 });
    }
    if (!affiliate.password_hash) {
      return NextResponse.json({ error: 'no_password_set' }, { status: 403 });
    }

    const result = await verifyPassword(password, affiliate.password_hash);
    if (!result.ok) {
      await logAttempt({ ip, coupon, success: false });
      return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
    }
    await logAttempt({ ip, coupon, success: true });

    if (result.needsRehash) {
      try {
        const newHash = await hashPassword(password);
        await supabaseAdmin.from('affiliates').update({ password_hash: newHash }).eq('id', affiliate.id);
      } catch {}
    }

    const token = signSession({
      id: affiliate.id,
      coupon: affiliate.coupon_code,
      is_admin: !!affiliate.is_admin,
    });

    const res = NextResponse.json({
      ok: true,
      affiliate: {
        id: affiliate.id,
        name: affiliate.name,
        coupon_code: affiliate.coupon_code,
        is_admin: !!affiliate.is_admin,
      },
    });

    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true,
      secure: true,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE,
    });

    return res;
  } catch (err) {
    return NextResponse.json({ error: 'unexpected', detail: String(err?.message || err) }, { status: 500 });
  }
}
