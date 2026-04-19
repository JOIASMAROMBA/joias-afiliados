import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const folderId = String(searchParams.get('folder_id') || '').trim();
    if (!folderId) return NextResponse.json({ error: 'missing_folder_id' }, { status: 400 });

    const r1 = await supabaseAdmin
      .from('material_files')
      .select('id, url, file_name, file_type, created_at, folder_id')
      .eq('folder_id', folderId)
      .order('created_at', { ascending: false });

    const r2 = await supabaseAdmin
      .from('material_files')
      .select('id, folder_id, url, file_name, file_type, created_at');

    return NextResponse.json({
      ok: true,
      files: r1.data || [],
      debug: {
        folderId_received: folderId,
        folderId_length: folderId.length,
        eq_error: r1.error ? r1.error.message : null,
        eq_count: (r1.data || []).length,
        all_error: r2.error ? r2.error.message : null,
        all_count: (r2.data || []).length,
        all_folder_ids: (r2.data || []).map(function(x) { return x.folder_id; }),
      },
    });
  } catch (err) {
    return NextResponse.json({ error: 'unexpected', detail: String(err?.message || err) }, { status: 500 });
  }
}
