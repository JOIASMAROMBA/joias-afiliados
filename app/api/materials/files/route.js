import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const folderId = String(searchParams.get('folder_id') || '').trim();
    if (!folderId) return NextResponse.json({ error: 'missing_folder_id' }, { status: 400 });

    const { data, error } = await supabaseAdmin
      .from('material_files')
      .select('id, url, file_name, file_type, created_at, folder_id')
      .in('folder_id', [folderId])
      .order('created_at', { ascending: false });
    if (error) return NextResponse.json({ error: 'db_error', detail: error.message }, { status: 500 });

    const filtered = (data || []).filter(function(f) { return f.folder_id === folderId; });
    const res = NextResponse.json({ ok: true, files: filtered.map(function(f) { return { id: f.id, url: f.url, file_name: f.file_name, file_type: f.file_type, created_at: f.created_at }; }) });
    res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    return res;
  } catch (err) {
    return NextResponse.json({ error: 'unexpected', detail: String(err?.message || err) }, { status: 500 });
  }
}
