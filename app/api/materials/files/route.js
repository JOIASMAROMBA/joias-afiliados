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
      .select('id, url, file_name, file_type, created_at')
      .eq('folder_id', folderId)
      .order('created_at', { ascending: false });
    if (error) return NextResponse.json({ error: 'db_error', detail: error.message }, { status: 500 });
    return NextResponse.json({ ok: true, files: data || [] });
  } catch (err) {
    return NextResponse.json({ error: 'unexpected', detail: String(err?.message || err) }, { status: 500 });
  }
}
