import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/auth';
import { supabaseAdmin } from '../../../../../lib/supabase-admin';
import { sendPushToAffiliate } from '../../../../../lib/push';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  var session = await requireAdmin(request);
  if (session.error) return NextResponse.json({ error: session.error }, { status: session.status });

  var body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  var affiliateId = body && body.affiliate_id;
  var quantity = Math.max(1, Math.min(50, parseInt(body && body.quantity, 10) || 1));
  if (!affiliateId) return NextResponse.json({ error: 'missing_affiliate' }, { status: 400 });

  var { data: affiliate, error: afErr } = await supabaseAdmin
    .from('affiliates')
    .select('id, name, coupon_code, commission_value')
    .eq('id', affiliateId)
    .maybeSingle();
  if (afErr) return NextResponse.json({ error: 'db_error', detail: afErr.message }, { status: 500 });
  if (!affiliate) return NextResponse.json({ error: 'affiliate_not_found' }, { status: 404 });

  var commission = Number(affiliate.commission_value || 25);
  var now = Date.now();
  var rows = [];
  for (var i = 0; i < quantity; i++) {
    rows.push({
      affiliate_id: affiliate.id,
      product_name: 'Venda manual',
      product_value: null,
      buyer_name: 'Insercao manual (admin)',
      buyer_city: null,
      commission_earned: commission,
      external_order_id: 'manual-' + now + '-' + i + '-' + Math.random().toString(36).slice(2, 8),
    });
  }

  var { error: insErr } = await supabaseAdmin.from('sales').insert(rows);
  if (insErr) return NextResponse.json({ error: 'insert_failed', detail: insErr.message }, { status: 500 });

  try {
    var valor = Number(commission * quantity).toFixed(2).replace('.', ',');
    var bodyMsg = quantity > 1
      ? '+R$' + valor + ' (' + quantity + ' vendas) acabou de cair!'
      : '+R$' + valor + ' de comissao acabou de cair!';
    await sendPushToAffiliate(affiliate.id, {
      title: 'VENDA NOVA',
      body: bodyMsg,
      url: '/painel',
      tag: 'venda-manual-' + now,
    });
  } catch (e) {}

  return NextResponse.json({ ok: true, inserted: quantity, commission_per_sale: commission, total: commission * quantity });
}
