import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const LI_BASE = 'https://api.awsli.com.br/api/v1';

export async function GET(request) {
  const session = await requireAdmin(request);
  if (session.error) return NextResponse.json({ error: session.error }, { status: session.status });

  const url = new URL(request.url);
  const id = (url.searchParams.get('id') || '').trim();
  if (!id) return NextResponse.json({ error: 'missing id param' }, { status: 400 });

  const chaveApi = (process.env.LOJA_INTEGRADA_API_KEY || '').trim();
  const chaveAplicacao = (process.env.LOJA_INTEGRADA_APP_KEY || chaveApi).trim();
  const queryAuth = `chave_api=${encodeURIComponent(chaveApi)}&chave_aplicacao=${encodeURIComponent(chaveAplicacao)}`;

  const paths = [
    `/pedido/${id}/?${queryAuth}`,
    `/pedido/search/?numero=${id}&${queryAuth}`,
    `/pedido_desconto/search/?pedido=${id}&${queryAuth}`,
    `/pedido_item_venda/search/?pedido=${id}&${queryAuth}`,
  ];

  const results = [];
  for (const path of paths) {
    try {
      const res = await fetch(LI_BASE + path, { headers: { Accept: 'application/json' }, cache: 'no-store' });
      const text = await res.text().catch(() => '');
      let parsed = null;
      try { parsed = JSON.parse(text); } catch (e) {}
      results.push({ path: path.split('?')[0], status: res.status, ok: res.ok, data: parsed || text.slice(0, 500) });
    } catch (err) {
      results.push({ path: path.split('?')[0], status: 0, ok: false, error: String(err && err.message || err) });
    }
  }

  return NextResponse.json({ id, results });
}
