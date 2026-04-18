import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/auth';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { sendPushToAffiliate } from '../../../../lib/push';

export const dynamic = 'force-dynamic';

async function insertPayment(affiliateId, amount, ruleId) {
  var externalId = 'fixed-' + ruleId + '-' + Date.now() + '-' + Math.random().toString(36).slice(2, 6);
  return supabaseAdmin.from('sales').insert({
    affiliate_id: affiliateId,
    product_name: 'Fixo Mensal',
    product_value: null,
    buyer_name: 'Pagamento fixo (patrocinio)',
    buyer_city: null,
    commission_earned: Number(amount),
    external_order_id: externalId,
    source: 'fixed_payment',
  });
}

async function tryNotify(affiliateId, amount) {
  try {
    var valor = Number(amount).toFixed(2).replace('.', ',');
    await sendPushToAffiliate(affiliateId, {
      title: 'FIXO MENSAL',
      body: 'Seu pagamento de R$' + valor + ' caiu!',
      url: '/painel',
      tag: 'fixo-' + Date.now(),
    });
  } catch (e) {}
}

function computeNextPaymentDate(rule) {
  var payday = Number(rule.payday);
  var nextY, nextM;
  if (rule.last_paid_at) {
    var last = new Date(rule.last_paid_at);
    nextY = last.getFullYear();
    nextM = last.getMonth() + 1;
    if (nextM > 11) { nextM = 0; nextY++; }
  } else {
    var base = new Date(rule.created_at || Date.now());
    var baseDay = base.getDate();
    nextY = base.getFullYear();
    nextM = base.getMonth();
    if (baseDay > payday) {
      nextM = nextM + 1;
      if (nextM > 11) { nextM = 0; nextY++; }
    }
  }
  var daysInMonth = new Date(nextY, nextM + 1, 0).getDate();
  var targetDay = Math.min(payday, daysInMonth);
  return new Date(nextY, nextM, targetDay, 0, 0, 0, 0);
}

function isDue(rule, now) {
  if (!rule.active) return false;
  if (rule.last_paid_at && !rule.recurring) return false;
  var next = computeNextPaymentDate(rule);
  return now >= next.getTime();
}

export async function POST(request) {
  var session = await requireAdmin(request);
  if (session.error) return NextResponse.json({ error: session.error }, { status: session.status });

  var url = new URL(request.url);
  var action = url.searchParams.get('action') || '';
  var body;
  try { body = await request.json(); } catch { body = {}; }

  if (action === 'create') {
    var affiliateId = body && body.affiliate_id;
    var amount = Number(body && body.amount);
    var payday = Math.floor(Number(body && body.payday));
    var recurring = !!(body && body.recurring);
    var notes = body && body.notes ? String(body.notes).slice(0, 500) : null;

    if (!affiliateId) return NextResponse.json({ error: 'missing_affiliate' }, { status: 400 });
    if (!Number.isFinite(amount) || amount <= 0) return NextResponse.json({ error: 'invalid_amount' }, { status: 400 });
    if (!Number.isFinite(payday) || payday < 1 || payday > 31) return NextResponse.json({ error: 'invalid_payday' }, { status: 400 });

    var ruleIns = await supabaseAdmin.from('monthly_fixed_payments').insert({
      affiliate_id: affiliateId,
      amount: amount,
      payday: payday,
      recurring: recurring,
      active: true,
      notes: notes,
      last_paid_at: null,
      created_by: session.affiliate.id,
    }).select().single();
    if (ruleIns.error) return NextResponse.json({ error: 'db_error', detail: ruleIns.error.message }, { status: 500 });

    // Se hoje ja e o payday (ou passou nesse mesmo mes apos criacao), process-due vai pagar no proximo load.
    // Se admin quer pagar agora, use o botao PAGAR na regra.

    return NextResponse.json({ ok: true, rule: ruleIns.data });
  }

  if (action === 'delete') {
    var ruleId = body && body.rule_id;
    if (!ruleId) return NextResponse.json({ error: 'missing_rule_id' }, { status: 400 });
    var { error } = await supabaseAdmin.from('monthly_fixed_payments').delete().eq('id', ruleId);
    if (error) return NextResponse.json({ error: 'db_error', detail: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  }

  if (action === 'toggle') {
    var ruleId2 = body && body.rule_id;
    if (!ruleId2) return NextResponse.json({ error: 'missing_rule_id' }, { status: 400 });
    var cur = await supabaseAdmin.from('monthly_fixed_payments').select('active').eq('id', ruleId2).maybeSingle();
    if (cur.error || !cur.data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    var upd = await supabaseAdmin.from('monthly_fixed_payments').update({ active: !cur.data.active }).eq('id', ruleId2);
    if (upd.error) return NextResponse.json({ error: 'db_error', detail: upd.error.message }, { status: 500 });
    return NextResponse.json({ ok: true, active: !cur.data.active });
  }

  if (action === 'pay-now') {
    var ruleId3 = body && body.rule_id;
    if (!ruleId3) return NextResponse.json({ error: 'missing_rule_id' }, { status: 400 });
    var ruleRes = await supabaseAdmin.from('monthly_fixed_payments').select('*').eq('id', ruleId3).maybeSingle();
    if (!ruleRes.data) return NextResponse.json({ error: 'not_found' }, { status: 404 });
    var rule = ruleRes.data;
    if (!rule.active) return NextResponse.json({ error: 'inactive' }, { status: 400 });
    var pRes = await insertPayment(rule.affiliate_id, rule.amount, rule.id);
    if (pRes.error) return NextResponse.json({ error: 'payment_failed', detail: pRes.error.message }, { status: 500 });
    await supabaseAdmin.from('monthly_fixed_payments').update({ last_paid_at: new Date().toISOString() }).eq('id', rule.id);
    await tryNotify(rule.affiliate_id, rule.amount);
    return NextResponse.json({ ok: true });
  }

  return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
}

export async function GET(request) {
  var session = await requireAdmin(request);
  if (session.error) return NextResponse.json({ error: session.error }, { status: session.status });

  var url = new URL(request.url);
  var action = url.searchParams.get('action') || 'list';

  if (action === 'process-due') {
    var { data: rules } = await supabaseAdmin
      .from('monthly_fixed_payments')
      .select('*')
      .eq('active', true)
      .eq('recurring', true);
    var processed = [];
    var now = Date.now();
    for (var i = 0; i < (rules || []).length; i++) {
      var r = rules[i];
      if (isDue(r, now)) {
        var pr = await insertPayment(r.affiliate_id, r.amount, r.id);
        if (!pr.error) {
          await supabaseAdmin.from('monthly_fixed_payments').update({ last_paid_at: new Date().toISOString() }).eq('id', r.id);
          await tryNotify(r.affiliate_id, r.amount);
          processed.push(r.id);
        }
      }
    }
    return NextResponse.json({ ok: true, processed: processed.length });
  }

  // list all
  var { data, error } = await supabaseAdmin
    .from('monthly_fixed_payments')
    .select('*, affiliates(id, name, coupon_code, avatar_initials, avatar_url)')
    .order('created_at', { ascending: false });
  if (error) return NextResponse.json({ error: 'db_error', detail: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, rules: data || [] });
}
