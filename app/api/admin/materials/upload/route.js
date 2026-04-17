import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase-admin';
import { requireAdmin } from '../../../../../lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

const MAX_SIZE = 50 * 1024 * 1024;

function detectFileType(buf) {
  if (buf.length < 16) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg', kind: 'image' };
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return { mime: 'image/png', ext: 'png', kind: 'image' };
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46) return { mime: 'image/gif', ext: 'gif', kind: 'image' };
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return { mime: 'image/webp', ext: 'webp', kind: 'image' };
  if (buf[4] === 0x66 && buf[5] === 0x74 && buf[6] === 0x79 && buf[7] === 0x70) return { mime: 'video/mp4', ext: 'mp4', kind: 'video' };
  if (buf[0] === 0x1a && buf[1] === 0x45 && buf[2] === 0xdf && buf[3] === 0xa3) return { mime: 'video/webm', ext: 'webm', kind: 'video' };
  if (buf[0] === 0x00 && buf[1] === 0x00 && buf[2] === 0x00 && (buf[4] === 0x66 || buf[4] === 0x6d)) return { mime: 'video/quicktime', ext: 'mov', kind: 'video' };
  return null;
}

export async function POST(request) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const form = await request.formData();
    const file = form.get('file');
    const folderId = String(form.get('folder_id') || '').trim();
    if (!file || typeof file.arrayBuffer !== 'function') return NextResponse.json({ error: 'no_file' }, { status: 400 });
    if (!folderId) return NextResponse.json({ error: 'missing_folder_id' }, { status: 400 });
    if (file.size > MAX_SIZE) return NextResponse.json({ error: 'file_too_large', max_mb: 50 }, { status: 413 });

    const ab = await file.arrayBuffer();
    const buf = Buffer.from(ab);
    const detected = detectFileType(buf);
    if (!detected) return NextResponse.json({ error: 'invalid_file', detail: 'apenas JPG, PNG, GIF, WebP, MP4, WebM, MOV' }, { status: 400 });

    const fileName = folderId + '/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + detected.ext;
    const up = await supabaseAdmin.storage.from('materials').upload(fileName, buf, {
      contentType: detected.mime,
      upsert: false,
      cacheControl: '3600',
    });
    if (up.error) return NextResponse.json({ error: 'upload_failed', detail: up.error.message }, { status: 500 });

    const pub = supabaseAdmin.storage.from('materials').getPublicUrl(fileName);
    const url = pub.data.publicUrl;

    const originalName = file.name ? String(file.name).slice(0, 200) : ('material.' + detected.ext);

    const insert = await supabaseAdmin.from('material_files').insert({
      folder_id: folderId,
      url,
      file_name: originalName,
      file_type: detected.kind,
    }).select().single();

    if (insert.error) return NextResponse.json({ error: 'db_error', detail: insert.error.message }, { status: 500 });
    return NextResponse.json({ ok: true, file: insert.data });
  } catch (err) {
    return NextResponse.json({ error: 'unexpected', detail: String(err?.message || err) }, { status: 500 });
  }
}
