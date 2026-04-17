import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';
import { sendPushToAffiliate } from '../../../../lib/push';

export const dynamic = 'force-dynamic';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

function extractCouponCode(order) {
  if (order?.cupom_desconto) return String(order.cupom_desconto).trim().toUpperCase();
  if (order?.cupom) return String(order.cupom).trim().toUpperCase();
  if (Array.isArray(order?.cupons) && order.cupons.length > 0) {
    return String(order.cupons[0]?.codigo || order.cupons[0]).trim().toUpperCase();
  }
  if (Array.isArray(order?.descontos)) {
    const cupom = order.descontos.find(d => d?.tipo === 'cupom' || d?.codigo);
    if (cupom) return String(cupom.codigo).trim().toUpperCase();
  }
  return null;
}

function extractBuyerName(order) {
  return order?.cliente?.nome || order?.cliente_nome || order?.nome_cliente || 'Cliente';
}

function extractBuyerCity(order) {
  return (
    order?.cliente?.endereco_principal?.cidade ||
    order?.endereco_entrega?.cidade ||
    order?.endereco_cobranca?.cidade ||
    order?.cidade ||
    null
  );
}

function extractOrderValue(order) {
  return Number(order?.valor_total || order?.total || order?.valor || 0);
}

function extractProductName(order) {
  if (Array.isArray(order?.itens) && order.itens.length > 0) {
    const nomes = order.itens.map(i => i?.nome || i?.produto?.nome).filter(Boolean);
    if (nomes.length > 0) return nomes.join(', ');
  }
  return 'Pedido Joias Maromba';
}

function isPaidStatus(order) {
  const status = String(order?.situacao || order?.status || '').toLowerCase();
  return ['pago', 'paid', 'aprovado', 'approved', 'faturado', 'concluido', 'concluído'].some(s => status.includes(s));
}

function safeEqual(a, b) {
  const ab = Buffer.from(String(a || ''));
  const bb = Buffer.from(String(b || ''));
  if (ab.length !== bb.length) return false;
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

export async function POST(request) {
  try {
    const url = new URL(request.url);
    const envSecret = (process.env.WEBHOOK_SECRET || '').trim();
    const secret = (url.searchParams.get('secret') || '').trim();
    if (!envSecret || !safeEqual(secret, envSecret)) {
      return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    }

    const payload = await request.json();
    const order = payload?.pedido || payload?.order || payload;

    if (!isPaidStatus(order)) {
      return NextResponse.json({ ok: true, skipped: 'status not paid' });
    }

    const coupon = extractCouponCode(order);
    if (!coupon) {
      return NextResponse.json({ ok: true, skipped: 'no coupon' });
    }

    const { data: affiliate } = await supabase
      .from('affiliates')
      .select('id, commission_value')
      .ilike('coupon_code', coupon)
      .maybeSingle();

    if (!affiliate) {
      return NextResponse.json({ ok: true, skipped: 'affiliate not found', coupon });
    }

    const externalId = String(order?.numero || order?.codigo || order?.id || '');
    if (externalId) {
      const { data: existing } = await supabase
        .from('sales')
        .select('id')
        .eq('external_order_id', externalId)
        .maybeSingle();
      if (existing) {
        return NextResponse.json({ ok: true, skipped: 'duplicate order', externalId });
      }
    }

    const commission = Number(affiliate.commission_value || 25);

    const { error: insertError } = await supabase.from('sales').insert({
      affiliate_id: affiliate.id,
      product_name: extractProductName(order),
      product_value: extractOrderValue(order),
      buyer_name: extractBuyerName(order),
      buyer_city: extractBuyerCity(order),
      commission_earned: commission,
      external_order_id: externalId || null,
    });

    if (insertError) {
      return NextResponse.json({ error: 'insert failed', details: insertError.message }, { status: 500 });
    }

    try {
      var valor = Number(commission).toFixed(2).replace('.', ',');
      await sendPushToAffiliate(affiliate.id, {
        title: 'VENDA NOVA',
        body: '+R$' + valor + ' de comissao acabou de cair!',
        url: '/painel',
        tag: 'venda-' + (externalId || Date.now()),
      });
    } catch (e) {}

    return NextResponse.json({ ok: true, affiliate_id: affiliate.id, commission });
  } catch (err) {
    return NextResponse.json({ error: 'exception', message: err?.message }, { status: 500 });
  }
}

export async function GET() {
  return NextResponse.json({ ok: true, endpoint: 'loja-integrada webhook' });
}
