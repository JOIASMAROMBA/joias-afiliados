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

      // 1. Buscar o arquivo
      const { data: rows } = await supabaseAdmin.from('material_files').select('id, url').in('id', [id]);
      const file = (rows || []).find(function(f) { return f.id === id; });
      if (!file) return NextResponse.json({ error: 'not_found', attempted_id: id }, { status: 404 });

      // 2. Remove do storage
      if (file.url) {
        try {
          const u = new URL(file.url);
          const path = u.pathname.split('/materials/')[1];
          if (path) await supabaseAdmin.storage.from('materials').remove([path]);
        } catch {}
      }

      // 3. Tenta delete por varios metodos (match, filter, eq) e retorna qual funcionou
      let deleted = 0;
      let attempts = [];

      const r1 = await supabaseAdmin.from('material_files').delete().match({ id: id }).select();
      attempts.push({ method: 'match', error: r1.error && r1.error.message, count: (r1.data || []).length });
      deleted += (r1.data || []).length;

      if (deleted === 0) {
        const r2 = await supabaseAdmin.from('material_files').delete().filter('id', 'eq', id).select();
        attempts.push({ method: 'filter', error: r2.error && r2.error.message, count: (r2.data || []).length });
        deleted += (r2.data || []).length;
      }

      if (deleted === 0) {
        const r3 = await supabaseAdmin.from('material_files').delete().in('id', [id]).select();
        attempts.push({ method: 'in', error: r3.error && r3.error.message, count: (r3.data || []).length });
        deleted += (r3.data || []).length;
      }

      // 4. Verificar se ainda existe
      const { data: stillThere } = await supabaseAdmin.from('material_files').select('id').in('id', [id]);
      const stillExists = (stillThere || []).some(function(f) { return f.id === id; });

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
