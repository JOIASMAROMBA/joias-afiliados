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

    if (action === 'create') {
      const name = String(body?.name || '').trim().slice(0, 120);
      const type = ['photo', 'video', 'mixed'].includes(body?.type) ? body.type : 'photo';
      const isUrgent = Boolean(body?.is_urgent);
      if (!name) return NextResponse.json({ error: 'missing_name' }, { status: 400 });
      const { data, error } = await supabaseAdmin.from('material_folders').insert({ name, type, is_urgent: isUrgent }).select().single();
      if (error) return NextResponse.json({ error: 'db_error', detail: error.message }, { status: 500 });
      return NextResponse.json({ ok: true, folder: data });
    }

    if (action === 'update') {
      const id = String(body?.id || '').trim();
      if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });
      const updates = {};
      if (body?.name !== undefined) updates.name = String(body.name).slice(0, 120);
      if (body?.type !== undefined && ['photo', 'video', 'mixed'].includes(body.type)) updates.type = body.type;
      if (body?.is_urgent !== undefined) updates.is_urgent = Boolean(body.is_urgent);
      const { error } = await supabaseAdmin.from('material_folders').update(updates).eq('id', id);
      if (error) return NextResponse.json({ error: 'db_error', detail: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    if (action === 'delete') {
      const id = String(body?.id || '').trim();
      if (!id) return NextResponse.json({ error: 'missing_id' }, { status: 400 });

      const { data: files } = await supabaseAdmin.from('material_files').select('url').eq('folder_id', id);
      if (files && files.length > 0) {
        const paths = files.map(f => { try { const u = new URL(f.url); return u.pathname.split('/materials/')[1]; } catch { return null; } }).filter(Boolean);
        if (paths.length > 0) { try { await supabaseAdmin.storage.from('materials').remove(paths); } catch {} }
      }
      const { error } = await supabaseAdmin.from('material_folders').delete().eq('id', id);
      if (error) return NextResponse.json({ error: 'db_error', detail: error.message }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'invalid_action' }, { status: 400 });
  } catch (err) {
    return NextResponse.json({ error: 'unexpected', detail: String(err?.message || err) }, { status: 500 });
  }
}
