import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { hashPassword, verifyPassword, signSession, COOKIE_NAME, SESSION_MAX_AGE } from '../../../../lib/auth';
import { getClientIp, checkRateLimit, logAttempt } from '../../../../lib/rate-limit';
import { sendEmail, emailEnabled, buildAdminCodeEmail } from '../../../../lib/email';

const ADMIN_CODE_TTL_MS = 10 * 60 * 1000;
const ADMIN_EMAIL = (process.env.ADMIN_NOTIFY_EMAIL || 'renanforumn@gmail.com').trim();

function generateCode() {
  let c = '';
  for (let i = 0; i < 6; i++) c += Math.floor(Math.random() * 10);
  return c;
}

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

    if (affiliate.is_admin) {
      if (!emailEnabled) {
        return NextResponse.json({ error: 'email_not_configured', detail: 'Admin 2FA requer email ativo' }, { status: 500 });
      }
      const code = generateCode();
      const expiresAt = new Date(Date.now() + ADMIN_CODE_TTL_MS).toISOString();
      const userAgent = String(request.headers.get('user-agent') || '').slice(0, 300);
      const insertRes = await supabaseAdmin.from('admin_login_codes').insert({
        affiliate_id: affiliate.id,
        code,
        expires_at: expiresAt,
        ip,
        user_agent: userAgent,
      }).select('id').single();
      if (insertRes.error) {
        return NextResponse.json({ error: 'db_error', detail: insertRes.error.message }, { status: 500 });
      }
      var emailError = null;
      var emailOk = false;
      try {
        const msg = buildAdminCodeEmail({ code, ip, userAgent });
        const sendRes = await sendEmail({ to: ADMIN_EMAIL, subject: msg.subject, html: msg.html });
        emailOk = !!(sendRes && sendRes.ok);
        if (!emailOk) emailError = (sendRes && sendRes.error) || 'unknown';
      } catch (e) { emailError = e && e.message ? e.message : String(e); }
      return NextResponse.json({
        ok: true,
        requires_admin_code: true,
        admin_email_hint: ADMIN_EMAIL.replace(/(.{2}).*(@.*)/, '$1***$2'),
        email_sent: emailOk,
        email_error: emailError,
      });
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
