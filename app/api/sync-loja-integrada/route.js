import { createClient } from '@supabase/supabase-js';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

const LI_BASE = 'https://api.awsli.com.br/api/v1';

function buildAuthHeaders(mode = 'full') {
  const chaveApi = (process.env.LOJA_INTEGRADA_API_KEY || '').trim();
  const chaveAplicacao = (process.env.LOJA_INTEGRADA_APP_KEY || '').trim();
  let auth;
  if (mode === 'api-only') auth = `chave_api ${chaveApi}`;
  else if (mode === 'app-only') auth = `chave_aplicacao ${chaveApi}`;
  else auth = `chave_api ${chaveApi}, chave_aplicacao ${chaveAplicacao || chaveApi}`;
  return { Authorization: auth, Accept: 'application/json' };
}

function extractCouponCode(order) {
  if (order?.cupom) return String(order.cupom).trim().toUpperCase();
  if (order?.cupom_desconto) return String(order.cupom_desconto).trim().toUpperCase();
  if (Array.isArray(order?.descontos)) {
    const cupom = order.descontos.find(d => d?.tipo === 'cupom' || d?.codigo);
    if (cupom?.codigo) return String(cupom.codigo).trim().toUpperCase();
  }
  if (order?.codigo_cupom) return String(order.codigo_cupom).trim().toUpperCase();
  return null;
}

function extractBuyerCity(order) {
  return (
    order?.cliente?.endereco_principal?.cidade ||
    order?.endereco_entrega?.cidade ||
    order?.endereco_cobranca?.cidade ||
    null
  );
}

function extractBuyerName(order) {
  return order?.cliente?.nome || order?.nome_cliente || 'Cliente';
}

function extractProductName(order) {
  if (Array.isArray(order?.itens) && order.itens.length > 0) {
    const nomes = order.itens.map(i => i?.nome || i?.produto?.nome).filter(Boolean);
    if (nomes.length > 0) return nomes.join(', ');
  }
  return 'Pedido Joias Maromba';
}

async function tryAuthModes(path) {
  const chaveApi = (process.env.LOJA_INTEGRADA_API_KEY || '').trim();
  const chaveAplicacao = (process.env.LOJA_INTEGRADA_APP_KEY || chaveApi).trim();
  const separator = path.includes('?') ? '&' : '?';
  const queryAuth = `chave_api=${encodeURIComponent(chaveApi)}&chave_aplicacao=${encodeURIComponent(chaveAplicacao)}`;

  const modes = [
    { name: 'query', url: `${LI_BASE}${path}${separator}${queryAuth}`, headers: { Accept: 'application/json' } },
    { name: 'header-full', url: `${LI_BASE}${path}`, headers: buildAuthHeaders('full') },
    { name: 'header-api-only', url: `${LI_BASE}${path}`, headers: buildAuthHeaders('api-only') },
    { name: 'header-app-only', url: `${LI_BASE}${path}`, headers: buildAuthHeaders('app-only') },
    { name: 'bearer', url: `${LI_BASE}${path}`, headers: { Authorization: `Bearer ${chaveApi}`, Accept: 'application/json' } },
  ];

  const attempts = [];
  for (const m of modes) {
    const res = await fetch(m.url, { headers: m.headers, cache: 'no-store' });
    const body = await res.text().catch(() => '');
    attempts.push({ mode: m.name, status: res.status, bodyPreview: body.slice(0, 150) });
    if (res.ok) return { ok: true, mode: m.name, data: JSON.parse(body) };
  }
  return { ok: false, attempts };
}

async function fetchPaidOrdersSince(sinceIso) {
  const path = `/pedido/search/?situacao=pago&data_inicio=${sinceIso}&limit=50`;
  const result = await tryAuthModes(path);
  if (!result.ok) {
    throw new Error(`All auth modes failed: ${JSON.stringify(result.attempts)}`);
  }
  const data = result.data;
  return { orders: data?.objects || data?.results || data?.pedidos || [], mode: result.mode };
}

async function processOrder(order) {
  const externalId = String(order?.numero || order?.codigo || order?.id || '');
  if (!externalId) return { skipped: 'no id' };

  const { data: existing } = await supabase
    .from('sales')
    .select('id')
    .eq('external_order_id', externalId)
    .maybeSingle();
  if (existing) return { skipped: 'duplicate', externalId };

  const coupon = extractCouponCode(order);
  if (!coupon) return { skipped: 'no coupon', externalId };

  const { data: affiliate } = await supabase
    .from('affiliates')
    .select('id, commission_value')
    .ilike('coupon_code', coupon)
    .maybeSingle();
  if (!affiliate) return { skipped: 'affiliate not found', coupon, externalId };

  const commission = Number(affiliate.commission_value || 25);

  const { error: insertError } = await supabase.from('sales').insert({
    affiliate_id: affiliate.id,
    product_name: extractProductName(order),
    product_value: Number(order?.valor_total || order?.total || 0),
    buyer_name: extractBuyerName(order),
    buyer_city: extractBuyerCity(order),
    commission_earned: commission,
    external_order_id: externalId,
  });

  if (insertError) return { error: insertError.message, externalId };
  return { inserted: true, affiliate_id: affiliate.id, commission, coupon, externalId };
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const envSecret = (process.env.WEBHOOK_SECRET || '').trim();
    const secret = (url.searchParams.get('secret') || '').trim();
    if (!envSecret || secret !== envSecret) {
      return NextResponse.json({
        error: 'unauthorized',
        hasEnv: !!envSecret,
        envLen: envSecret.length,
        gotLen: secret.length,
        envStart: envSecret.slice(0, 4),
        gotStart: secret.slice(0, 4),
      }, { status: 401 });
    }

    if (!process.env.LOJA_INTEGRADA_API_KEY) {
      return NextResponse.json({ error: 'missing LOJA_INTEGRADA_API_KEY' }, { status: 500 });
    }

    const hoursBack = Number(url.searchParams.get('hours') || 24);
    const since = new Date(Date.now() - hoursBack * 60 * 60 * 1000);
    const sinceIso = since.toISOString().split('T')[0];

    const { orders, mode: authMode } = await fetchPaidOrdersSince(sinceIso);
    const results = [];
    for (const order of orders) {
      results.push(await processOrder(order));
    }

    const inserted = results.filter(r => r.inserted).length;
    const skipped = results.filter(r => r.skipped).length;
    const errored = results.filter(r => r.error).length;

    return NextResponse.json({
      ok: true,
      authMode,
      since: sinceIso,
      fetched: orders.length,
      inserted,
      skipped,
      errored,
      results,
    });
  } catch (err) {
    return NextResponse.json({ error: 'exception', message: err?.message }, { status: 500 });
  }
}
