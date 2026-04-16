import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requireSession } from '../../../../lib/auth';
import { getClientIp } from '../../../../lib/rate-limit';
import { sendEmail, emailEnabled } from '../../../../lib/email';

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

    await logAudit({
      event: 'withdrawal_created',
      affiliateId: auth.affiliate.id,
      ip,
      metadata: { withdrawal_id: insertRes.data.id, amount, pix_type: pixType },
    });

    if (emailEnabled) {
      try {
        await sendEmail({
          to: email,
          subject: 'Joias Maromba - Solicitacao de saque recebida',
          html: `<!DOCTYPE html><html><body style="margin:0;padding:0;font-family:Arial;background:#0a0a0a;color:#fff;">
<div style="max-width:500px;margin:40px auto;padding:30px;background:linear-gradient(180deg,#1a0a2e,#0a0a0a);border:1px solid #FFD700;border-radius:16px;">
<div style="text-align:center;margin-bottom:24px;"><div style="font-size:40px;">💰</div><h1 style="color:#FFD700;font-size:20px;margin:8px 0;">Saque solicitado</h1></div>
<p style="font-size:14px;line-height:1.6;color:rgba(255,255,255,0.85);">Ola ${auth.affiliate.name || 'afiliada'},</p>
<p style="font-size:14px;line-height:1.6;color:rgba(255,255,255,0.85);">Sua solicitacao de saque foi registrada:</p>
<div style="background:rgba(255,215,0,0.1);padding:16px;border-radius:10px;margin:16px 0;">
<div style="font-size:13px;color:#FFD700;margin-bottom:4px;">VALOR</div>
<div style="font-size:24px;font-weight:900;color:#00ff88;">R$ ${amount.toFixed(2).replace('.', ',')}</div>
<div style="font-size:12px;color:rgba(255,215,0,0.7);margin-top:10px;">Chave PIX (${pixType}): ${pixKey}</div>
<div style="font-size:11px;color:rgba(255,215,0,0.5);margin-top:6px;">IP: ${ip}</div>
</div>
<p style="font-size:13px;color:rgba(255,255,255,0.7);line-height:1.6;">Prazo de pagamento: ate 24 horas. Se nao foi voce que solicitou, responda esse email imediatamente.</p>
</div></body></html>`,
        });
      } catch {}
    }

    return NextResponse.json({ ok: true, withdrawal_id: insertRes.data.id });
  } catch (err) {
    return NextResponse.json({ error: 'unexpected', detail: String(err?.message || err) }, { status: 500 });
  }
}
