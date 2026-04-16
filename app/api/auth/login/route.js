import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { hashPassword, verifyPassword, signSession, COOKIE_NAME, SESSION_MAX_AGE } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request) {
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

  const { data: affiliate, error } = await supabaseAdmin
    .from('affiliates')
    .select('id, name, coupon_code, password_hash, is_admin, blocked')
    .ilike('coupon_code', coupon)
    .maybeSingle();

  if (error || !affiliate) {
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
  }

  if (affiliate.blocked) {
    return NextResponse.json({ error: 'blocked' }, { status: 403 });
  }

  if (!affiliate.password_hash) {
    return NextResponse.json({ error: 'no_password_set' }, { status: 403 });
  }

  const result = await verifyPassword(password, affiliate.password_hash);
  if (!result.ok) {
    return NextResponse.json({ error: 'invalid_credentials' }, { status: 401 });
  }

  if (result.needsRehash) {
    const newHash = await hashPassword(password);
    await supabaseAdmin.from('affiliates').update({ password_hash: newHash }).eq('id', affiliate.id);
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
}
