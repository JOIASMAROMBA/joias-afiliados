import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase-admin';
import { requireAdmin } from '../../../../../lib/auth';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || '').trim();

    if (action === 'delete') {
      const id = String(body?.id || '').trim();
      if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });

      // 1. Buscar TUDO sem filtro (workaround bug do PostgREST) e filtrar em JS
      const { data: allRows } = await supabaseAdmin.from('material_files').select('id, url');
      const file = (allRows || []).find(function(f) { return f.id === id; });
      if (!file) return NextResponse.json({ error: 'not_found', attempted_id: id }, { status: 404 });

      // 2. Remove do storage
      if (file.url) {
        try {
          const u = new URL(file.url);
          const path = u.pathname.split('/materials/')[1];
          if (path) await supabaseAdmin.storage.from('materials').remove([path]);
        } catch {}
      }

      // 3. Delete por qualquer metodo que funcionar
      let attempts = [];
      let deleted = 0;

      const r1 = await supabaseAdmin.from('material_files').delete().match({ id: id }).select();
      attempts.push({ method: 'match', error: r1.error && r1.error.message, count: (r1.data || []).length });
      deleted += (r1.data || []).length;

      if (deleted === 0) {
        const r2 = await supabaseAdmin.from('material_files').delete().in('id', [id]).select();
        attempts.push({ method: 'in', error: r2.error && r2.error.message, count: (r2.data || []).length });
        deleted += (r2.data || []).length;
      }

      // 4. Verifica se ainda existe com busca sem filtro
      const { data: stillRows } = await supabaseAdmin.from('material_files').select('id');
      const stillExists = (stillRows || []).some(function(f) { return f.id === id; });

      if (stillExists) {
        return NextResponse.json({ error: 'delete_failed', detail: 'Row still exists after delete attempts', attempts: attempts }, { status: 500 });
      }

      return NextResponse.json({ ok: true, deleted: deleted, attempts: attempts });
    }

    return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: 'unexpected', detail: String(err?.message || err) }, { status: 500 });
  }
}
