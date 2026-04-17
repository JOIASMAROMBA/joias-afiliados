import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { data, error } = await supabaseAdmin
      .from('material_folders')
      .select('id, name, type, is_urgent, order_position, created_at')
      .order('is_urgent', { ascending: false })
      .order('order_position', { ascending: true })
      .order('created_at', { ascending: true });
    if (error) return NextResponse.json({ error: 'db_error', detail: error.message }, { status: 500 });

    const folderIds = (data || []).map(f => f.id);
    let counts = {};
    if (folderIds.length > 0) {
      const countRes = await supabaseAdmin
        .from('material_files')
        .select('folder_id', { count: 'exact' })
        .in('folder_id', folderIds);
      (countRes.data || []).forEach(r => { counts[r.folder_id] = (counts[r.folder_id] || 0) + 1; });
    }
    const folders = (data || []).map(f => ({ ...f, file_count: counts[f.id] || 0 }));
    return NextResponse.json({ ok: true, folders });
  } catch (err) {
    return NextResponse.json({ error: 'unexpected', detail: String(err?.message || err) }, { status: 500 });
  }
}
