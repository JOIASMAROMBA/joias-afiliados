import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const LI_BASE = 'https://api.awsli.com.br/api/v1';

export async function GET(request) {
  var session = await requireAdmin(request);
  if (session.error) return NextResponse.json({ error: session.error }, { status: session.status });

  var chaveApi = (process.env.LOJA_INTEGRADA_API_KEY || '').trim();
  var chaveAplicacao = (process.env.LOJA_INTEGRADA_APP_KEY || '').trim();

  var envStatus = {
    api_key_present: chaveApi.length > 0,
    api_key_length: chaveApi.length,
    app_key_present: chaveAplicacao.length > 0,
    app_key_length: chaveAplicacao.length,
  };

  if (!chaveApi) {
    return NextResponse.json({ ok: false, error: 'missing_api_key', env: envStatus }, { status: 500 });
  }

  var path = '/pedido/search/?limit=1';
  var queryAuth = 'chave_api=' + encodeURIComponent(chaveApi) + '&chave_aplicacao=' + encodeURIComponent(chaveAplicacao || chaveApi);
  var separator = path.indexOf('?') >= 0 ? '&' : '?';

  var modes = [
    { name: 'query', url: LI_BASE + path + separator + queryAuth, headers: { Accept: 'application/json' } },
    { name: 'header-full', url: LI_BASE + path, headers: { Authorization: 'chave_api ' + chaveApi + ', chave_aplicacao ' + (chaveAplicacao || chaveApi), Accept: 'application/json' } },
    { name: 'header-api-only', url: LI_BASE + path, headers: { Authorization: 'chave_api ' + chaveApi, Accept: 'application/json' } },
    { name: 'bearer', url: LI_BASE + path, headers: { Authorization: 'Bearer ' + chaveApi, Accept: 'application/json' } },
  ];

  var attempts = [];
  var winner = null;
  var totalOrders = null;
  var sampleOrder = null;

  for (var i = 0; i < modes.length; i++) {
    var m = modes[i];
    try {
      var res = await fetch(m.url, { headers: m.headers, cache: 'no-store' });
      var text = await res.text().catch(function() { return ''; });
      var entry = { mode: m.name, status: res.status, ok: res.ok, bodyPreview: text.slice(0, 200) };
      attempts.push(entry);
      if (res.ok && !winner) {
        winner = m.name;
        try {
          var parsed = JSON.parse(text);
          totalOrders = (parsed && (parsed.meta && parsed.meta.total_count)) || (Array.isArray(parsed && parsed.objects) ? parsed.objects.length : null);
          if (parsed && parsed.objects && parsed.objects[0]) {
            var o = parsed.objects[0];
            sampleOrder = {
              id: o.id || o.numero || o.codigo,
              status: o.situacao || o.status,
              total: o.valor_total || o.total,
              has_coupon: Boolean(o.cupom || o.cupom_desconto || (o.cupons && o.cupons.length)),
              data: o.data_criacao || o.data,
            };
          }
        } catch (e) {}
      }
    } catch (err) {
      attempts.push({ mode: m.name, status: 0, ok: false, error: String(err && err.message || err) });
    }
  }

  return NextResponse.json({
    ok: Boolean(winner),
    winner: winner,
    total_orders_in_store: totalOrders,
    sample_order: sampleOrder,
    env: envStatus,
    attempts: attempts,
  });
}
