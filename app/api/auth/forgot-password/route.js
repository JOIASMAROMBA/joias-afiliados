import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { hashPassword } from '../../../../lib/auth';
import { getClientIp, checkRateLimit, logAttempt } from '../../../../lib/rate-limit';
import { sendEmail, buildResetPasswordEmail, emailEnabled } from '../../../../lib/email';

export const dynamic = 'force-dynamic';

function generateProvisionalPassword() {
  let p = '';
  for (let i = 0; i < 6; i++) p += Math.floor(Math.random() * 10);
  return p;
}

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
      .select('id, name, email, coupon_code, gender')
      .ilike('coupon_code', coupon)
      .maybeSingle();

    if (!affiliate || String(affiliate.email || '').toLowerCase() !== email) {
      await logAttempt({ ip, coupon, success: false });
      return NextResponse.json({ error: 'not_found' }, { status: 404 });
    }

    const provisional = generateProvisionalPassword();
    const hash = await hashPassword(provisional);

    const updateResult = await supabaseAdmin
      .from('affiliates')
      .update({ password_hash: hash })
      .eq('id', affiliate.id);

    if (updateResult.error) {
      return NextResponse.json({ error: 'db_error', detail: updateResult.error.message }, { status: 500 });
    }

    await supabaseAdmin.from('password_resets').insert({
      affiliate_id: affiliate.id,
      requested_email: email,
      ip,
      status: emailEnabled ? 'sent' : 'pending',
    });

    if (emailEnabled) {
      const emailContent = buildResetPasswordEmail({
        name: affiliate.name,
        coupon: affiliate.coupon_code,
        provisionalPassword: provisional,
        gender: affiliate.gender,
      });
      const sendResult = await sendEmail({ to: email, ...emailContent });
      if (!sendResult.ok) {
        return NextResponse.json({ ok: true, email_sent: false, email_error: sendResult.error });
      }
      return NextResponse.json({ ok: true, email_sent: true });
    }

    return NextResponse.json({ ok: true, email_sent: false });
  } catch (err) {
    return NextResponse.json({ error: 'unexpected', detail: String(err?.message || err) }, { status: 500 });
  }
}
