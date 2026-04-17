import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { hashPassword, signSession, COOKIE_NAME, SESSION_MAX_AGE } from '../../../../lib/auth';
import { getClientIp, checkRateLimit, logAttempt } from '../../../../lib/rate-limit';

export const dynamic = 'force-dynamic';

function validEmail(e) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e); }

export async function POST(request) {
  try {
    if (!process.env.AUTH_JWT_SECRET || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'server_misconfigured' }, { status: 500 });
    }

    const ip = getClientIp(request);
    const rl = await checkRateLimit({ ip, coupon: null });
    if (rl.blocked) {
      return NextResponse.json({ error: 'rate_limited', retry_in: rl.retry_in }, { status: 429 });
    }

    let body;
    try { body = await request.json(); } catch { return NextResponse.json({ error: 'invalid_body' }, { status: 400 }); }

    const name = String(body?.name || '').trim().slice(0, 120);
    const email = String(body?.email || '').trim().toLowerCase().slice(0, 200);
    const coupon = String(body?.coupon || '').trim().toUpperCase().slice(0, 40);
    const password = String(body?.password || '').trim();
    const age = String(body?.age || '').trim().slice(0, 10);
    const city = String(body?.city || '').trim().slice(0, 120);
    const platforms = Array.isArray(body?.platforms) ? body.platforms.slice(0, 10).map(x => String(x).slice(0, 40)) : [];
    const social = (body?.social && typeof body.social === 'object') ? body.social : {};

    if (!name || name.length < 2) return NextResponse.json({ error: 'invalid_name' }, { status: 400 });
    if (!validEmail(email)) return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
    if (!/^[A-Z0-9]{3,40}$/.test(coupon)) return NextResponse.json({ error: 'invalid_coupon' }, { status: 400 });
    if (!/^\d{6}$/.test(password)) return NextResponse.json({ error: 'invalid_password' }, { status: 400 });

    const { data: existingCoupon } = await supabaseAdmin
      .from('affiliates').select('id').ilike('coupon_code', coupon).maybeSingle();
    if (existingCoupon) {
      await logAttempt({ ip, coupon, success: false });
      return NextResponse.json({ error: 'coupon_taken' }, { status: 409 });
    }

    const { data: existingEmail } = await supabaseAdmin
      .from('affiliates').select('id').ilike('email', email).maybeSingle();
    if (existingEmail) {
      await logAttempt({ ip, coupon, success: false });
      return NextResponse.json({ error: 'email_taken' }, { status: 409 });
    }

    const nameParts = name.split(' ').filter(Boolean);
    const initials = nameParts.length >= 2
      ? (nameParts[0][0] + nameParts[nameParts.length - 1][0]).toUpperCase()
      : name.substring(0, 2).toUpperCase();

    const safeSocial = {};
    ['instagram', 'facebook', 'tiktok', 'outro'].forEach(k => {
      if (social[k] && typeof social[k] === 'string') safeSocial[k] = String(social[k]).slice(0, 120);
    });

    const password_hash = await hashPassword(password);

    const insertResult = await supabaseAdmin.from('affiliates').insert({
      name,
      email,
      phone: city,
      instagram: JSON.stringify({ age, city, platforms, social: safeSocial }),
      coupon_code: coupon,
      avatar_initials: initials,
      tier: 'Divulgadora',
      is_sponsored: false,
      commission_value: 25,
      commission_type: 'fixed_per_sale',
      active: true,
      password_hash,
    }).select('id, name, coupon_code, is_admin').single();

    if (insertResult.error || !insertResult.data) {
      return NextResponse.json({ error: 'db_error', detail: insertResult.error?.message }, { status: 500 });
    }

    const affiliate = insertResult.data;
    const token = signSession({ id: affiliate.id, coupon: affiliate.coupon_code, is_admin: false });

    const res = NextResponse.json({ ok: true, affiliate });
    res.cookies.set(COOKIE_NAME, token, {
      httpOnly: true, secure: true, sameSite: 'lax', path: '/', maxAge: SESSION_MAX_AGE,
    });
    return res;
  } catch (err) {
    return NextResponse.json({ error: 'unexpected', detail: String(err?.message || err) }, { status: 500 });
  }
}
