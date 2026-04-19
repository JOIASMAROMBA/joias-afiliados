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
      const { data: files } = await supabaseAdmin.from('material_files').select('id, url').in('id', [id]);
      const file = (files || []).find(function(f) { return f.id === id; });
      if (file && file.url) {
        try {
          const u = new URL(file.url);
          const path = u.pathname.split('/materials/')[1];
          if (path) await supabaseAdmin.storage.from('materials').remove([path]);
        } catch {}
      }
      const delRes = await supabaseAdmin.from('material_files').delete().match({ id: id }).select();
      if (delRes.error) return NextResponse.json({ error: 'db_error', detail: delRes.error.message }, { status: 500 });
      return NextResponse.json({ ok: true, deleted: (delRes.data || []).length });
    }

    return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: 'unexpected', detail: String(err?.message || err) }, { status: 500 });
  }
}
