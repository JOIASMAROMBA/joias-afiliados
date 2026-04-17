import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requireSession } from '../../../../lib/auth';
import { getClientIp } from '../../../../lib/rate-limit';
import { sendEmail, emailEnabled, buildWithdrawalCodeEmail } from '../../../../lib/email';

export const dynamic = 'force-dynamic';

const MIN_AMOUNT = 10;
const PIX_TYPES = ['cpf', 'email', 'telefone', 'aleatoria'];
const CODE_TTL_MS = 10 * 60 * 1000;

function validatePixKey(type, key) {
  const k = String(key || '').trim();
  if (!k) return false;
  if (type === 'cpf') return k.replace(/\D/g, '').length === 11;
  if (type === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(k);
  if (type === 'telefone') {
    const d = k.replace(/\D/g, '');
    return d.length >= 10 && d.length <= 13;
  }
  if (type === 'aleatoria') return k.length >= 30 && k.length <= 40;
  return false;
}

function generateCode() {
  let c = '';
  for (let i = 0; i < 6; i++) c += Math.floor(Math.random() * 10);
  return c;
}

export async function POST(request) {
  var ip = getClientIp(request);
  try {
    var auth = await requireSession(request);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    var body = await request.json().catch(function() { return {}; });
    var amount = Number(body.amount);
    var pixType = String(body.pix_type || '').trim().toLowerCase();
    var pixKey = String(body.pix_key || '').trim();
    var email = String(body.email || '').trim().toLowerCase();

    if (!Number.isFinite(amount) || amount < MIN_AMOUNT) return NextResponse.json({ error: 'invalid_amount', min: MIN_AMOUNT }, { status: 400 });
    if (!PIX_TYPES.includes(pixType)) return NextResponse.json({ error: 'invalid_pix_type' }, { status: 400 });
    if (!validatePixKey(pixType, pixKey)) return NextResponse.json({ error: 'invalid_pix_key' }, { status: 400 });
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return NextResponse.json({ error: 'invalid_email' }, { status: 400 });

    var tenMinAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
    var recent = await supabaseAdmin
      .from('withdrawal_codes')
      .select('id', { count: 'exact', head: true })
      .eq('affiliate_id', auth.affiliate.id)
      .gte('created_at', tenMinAgo);
    if ((recent.count || 0) >= 5) {
      return NextResponse.json({ error: 'too_many_codes', detail: 'Aguarde antes de solicitar novo codigo' }, { status: 429 });
    }

    var balanceRes = await supabaseAdmin.from('affiliate_balance').select('available_balance').eq('id', auth.affiliate.id).maybeSingle();
    var available = Number((balanceRes.data && balanceRes.data.available_balance) || 0);
    if (amount > available) return NextResponse.json({ error: 'insufficient_balance', available: available }, { status: 400 });

    var pendingCheck = await supabaseAdmin
      .from('withdrawals')
      .select('id')
      .eq('affiliate_id', auth.affiliate.id)
      .eq('status', 'pending')
      .limit(1);
    if (pendingCheck.data && pendingCheck.data.length > 0) return NextResponse.json({ error: 'has_pending' }, { status: 409 });

    var code = generateCode();
    var expiresAt = new Date(Date.now() + CODE_TTL_MS).toISOString();

    var insertRes = await supabaseAdmin.from('withdrawal_codes').insert({
      affiliate_id: auth.affiliate.id,
      code: code,
      pix_type: pixType,
      pix_key: pixKey,
      amount: amount,
      email: email,
      expires_at: expiresAt,
    }).select().single();
    if (insertRes.error) return NextResponse.json({ error: 'db_error', detail: insertRes.error.message }, { status: 500 });

    if (!emailEnabled) {
      return NextResponse.json({ error: 'email_not_configured', detail: 'Contate o admin' }, { status: 500 });
    }

    var msg = buildWithdrawalCodeEmail({
      name: auth.affiliate.name,
      coupon: auth.affiliate.coupon_code,
      code: code,
      amount: amount,
      pixType: pixType,
      pixKey: pixKey,
    });
    var sendRes = await sendEmail({ to: email, subject: msg.subject, html: msg.html });
    if (!sendRes.ok) {
      return NextResponse.json({ error: 'send_failed', detail: sendRes.error }, { status: 500 });
    }

    return NextResponse.json({ ok: true, expires_in_sec: Math.floor(CODE_TTL_MS / 1000) });
  } catch (err) {
    return NextResponse.json({ error: 'unexpected', detail: String(err && err.message || err) }, { status: 500 });
  }
}
