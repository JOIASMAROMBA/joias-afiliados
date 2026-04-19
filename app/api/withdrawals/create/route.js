import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requireSession } from '../../../../lib/auth';
import { getClientIp } from '../../../../lib/rate-limit';
import { sendEmail, emailEnabled, buildWithdrawalCreatedEmail } from '../../../../lib/email';

export const dynamic = 'force-dynamic';

const MIN_AMOUNT = 10;
const PIX_TYPES = ['cpf', 'email', 'telefone', 'aleatoria'];

function validatePixKey(type, key) {
  const k = String(key || '').trim();
  if (!k) return false;
  if (type === 'cpf') {
    const digits = k.replace(/\D/g, '');
    return digits.length === 11;
  }
  if (type === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(k);
  if (type === 'telefone') {
    const digits = k.replace(/\D/g, '');
    return digits.length >= 10 && digits.length <= 13;
  }
  if (type === 'aleatoria') return k.length >= 30 && k.length <= 40;
  return false;
}

async function logAudit({ event, affiliateId, ip, metadata }) {
  try {
    await supabaseAdmin.from('audit_log').insert({
      event,
      affiliate_id: affiliateId,
      ip: ip || null,
      metadata: metadata ? JSON.stringify(metadata) : null,
    });
  } catch {}
}

export async function POST(request) {
  const ip = getClientIp(request);
  try {
    const auth = await requireSession(request);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await request.json().catch(() => ({}));
    const amount = Number(body?.amount);
    const pixType = String(body?.pix_type || '').trim().toLowerCase();
    const pixKey = String(body?.pix_key || '').trim();
    const email = String(body?.email || '').trim().toLowerCase();
    const code = String(body?.code || '').trim();

    if (!Number.isFinite(amount) || amount < MIN_AMOUNT) {
      await logAudit({ event: 'withdrawal_rejected', affiliateId: auth.affiliate.id, ip, metadata: { reason: 'invalid_amount', amount } });
      return NextResponse.json({ error: 'invalid_amount', min: MIN_AMOUNT }, { status: 400 });
    }
    if (!PIX_TYPES.includes(pixType)) {
      return NextResponse.json({ error: 'invalid_pix_type' }, { status: 400 });
    }
    if (!validatePixKey(pixType, pixKey)) {
      return NextResponse.json({ error: 'invalid_pix_key' }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
    }
    if (!/^\d{6}$/.test(code)) {
      return NextResponse.json({ error: 'invalid_code', detail: 'Codigo de confirmacao obrigatorio (6 digitos)' }, { status: 400 });
    }

    const codeRes = await supabaseAdmin
      .from('withdrawal_codes')
      .select('*')
      .eq('affiliate_id', auth.affiliate.id)
      .is('used_at', null)
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    const codeRow = codeRes.data;

    if (!codeRow) {
      await logAudit({ event: 'withdrawal_rejected', affiliateId: auth.affiliate.id, ip, metadata: { reason: 'no_active_code' } });
      return NextResponse.json({ error: 'no_active_code', detail: 'Solicite um codigo antes' }, { status: 400 });
    }
    if (new Date(codeRow.expires_at).getTime() < Date.now()) {
      await logAudit({ event: 'withdrawal_rejected', affiliateId: auth.affiliate.id, ip, metadata: { reason: 'code_expired' } });
      return NextResponse.json({ error: 'code_expired', detail: 'Codigo expirado, solicite outro' }, { status: 400 });
    }
    if ((codeRow.attempts || 0) >= 5) {
      await logAudit({ event: 'withdrawal_rejected', affiliateId: auth.affiliate.id, ip, metadata: { reason: 'code_attempts_exceeded' } });
      return NextResponse.json({ error: 'too_many_attempts', detail: 'Muitas tentativas. Solicite novo codigo' }, { status: 400 });
    }
    if (codeRow.code !== code) {
      await supabaseAdmin.from('withdrawal_codes').update({ attempts: (codeRow.attempts || 0) + 1 }).eq('id', codeRow.id);
      await logAudit({ event: 'withdrawal_rejected', affiliateId: auth.affiliate.id, ip, metadata: { reason: 'wrong_code' } });
      return NextResponse.json({ error: 'wrong_code', detail: 'Codigo incorreto' }, { status: 400 });
    }
    if (
      Number(codeRow.amount) !== amount ||
      codeRow.pix_type !== pixType ||
      codeRow.pix_key !== pixKey ||
      codeRow.email !== email
    ) {
      await logAudit({ event: 'withdrawal_rejected', affiliateId: auth.affiliate.id, ip, metadata: { reason: 'code_mismatch' } });
      return NextResponse.json({ error: 'code_mismatch', detail: 'Dados nao batem com o codigo. Solicite novo codigo' }, { status: 400 });
    }

    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
    const recentCheck = await supabaseAdmin
      .from('withdrawals')
      .select('id', { count: 'exact', head: true })
      .eq('affiliate_id', auth.affiliate.id)
      .gte('created_at', oneDayAgo);
    if ((recentCheck.count || 0) >= 3) {
      await logAudit({ event: 'withdrawal_rate_limited', affiliateId: auth.affiliate.id, ip, metadata: { count: recentCheck.count } });
      return NextResponse.json({ error: 'daily_limit_reached', detail: 'max 3 saques por dia' }, { status: 429 });
    }

    const pendingCheck = await supabaseAdmin
      .from('withdrawals')
      .select('id, amount')
      .eq('affiliate_id', auth.affiliate.id)
      .eq('status', 'pending')
      .limit(1);
    if (pendingCheck.data && pendingCheck.data.length > 0) {
      return NextResponse.json({ error: 'has_pending', detail: 'voce ja tem um saque pendente' }, { status: 409 });
    }

    const balanceRes = await supabaseAdmin.from('affiliate_balance').select('available_balance').eq('id', auth.affiliate.id).maybeSingle();
    const available = Number(balanceRes.data?.available_balance || 0);
    if (amount > available) {
      await logAudit({ event: 'withdrawal_rejected', affiliateId: auth.affiliate.id, ip, metadata: { reason: 'insufficient_balance', requested: amount, available } });
      return NextResponse.json({ error: 'insufficient_balance', available }, { status: 400 });
    }

    const insertRes = await supabaseAdmin.from('withdrawals').insert({
      affiliate_id: auth.affiliate.id,
      amount,
      pix_key: pixKey,
      pix_type: pixType,
      affiliate_email: email,
      status: 'pending',
    }).select().single();

    if (insertRes.error) {
      return NextResponse.json({ error: 'db_error', detail: insertRes.error.message }, { status: 500 });
    }

    try {
      await supabaseAdmin.from('withdrawal_codes').update({ used_at: new Date().toISOString() }).eq('id', codeRow.id);
    } catch (e) {}

    await logAudit({
      event: 'withdrawal_created',
      affiliateId: auth.affiliate.id,
      ip,
      metadata: { withdrawal_id: insertRes.data.id, amount, pix_type: pixType },
    });

    if (emailEnabled) {
      try {
        var msg = buildWithdrawalCreatedEmail({
          name: auth.affiliate.name,
          amount: amount,
          pixType: pixType,
          pixKey: pixKey,
          ip: ip,
          gender: auth.affiliate.gender,
        });
        await sendEmail({ to: email, subject: msg.subject, html: msg.html });
      } catch {}
    }

    return NextResponse.json({ ok: true, withdrawal_id: insertRes.data.id });
  } catch (err) {
    return NextResponse.json({ error: 'unexpected', detail: String(err?.message || err) }, { status: 500 });
  }
}
