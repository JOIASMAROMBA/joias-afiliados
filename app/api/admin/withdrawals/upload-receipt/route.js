import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase-admin';
import { requireAdmin } from '../../../../../lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MAX_SIZE = 10 * 1024 * 1024;

function detectFileType(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return { mime: 'image/png', ext: 'png' };
  if (buf[0] === 0x25 && buf[1] === 0x50 && buf[2] === 0x44 && buf[3] === 0x46) return { mime: 'application/pdf', ext: 'pdf' };
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return { mime: 'image/webp', ext: 'webp' };
  return null;
}

export async function POST(request) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const form = await request.formData();
    const file = form.get('file');
    const withdrawalId = String(form.get('withdrawal_id') || '').trim();
    if (!file || typeof file.arrayBuffer !== 'function') return NextResponse.json({ error: 'no_file' }, { status: 400 });
    if (!withdrawalId) return NextResponse.json({ error: 'missing_withdrawal_id' }, { status: 400 });
    if (file.size > MAX_SIZE) return NextResponse.json({ error: 'file_too_large' }, { status: 413 });

    const ab = await file.arrayBuffer();
    const buf = Buffer.from(ab);
    const detected = detectFileType(buf);
    if (!detected) return NextResponse.json({ error: 'invalid_file', detail: 'only JPEG/PNG/WebP/PDF allowed' }, { status: 400 });

    const fileName = 'receipt-' + withdrawalId + '-' + Date.now() + '.' + detected.ext;
    const up = await supabaseAdmin.storage.from('receipts').upload(fileName, buf, {
      contentType: detected.mime,
      upsert: true,
      cacheControl: '3600',
    });
    if (up.error) return NextResponse.json({ error: 'upload_failed', detail: up.error.message }, { status: 500 });

    const pub = supabaseAdmin.storage.from('receipts').getPublicUrl(fileName);
    const url = pub.data.publicUrl;

    const updateRes = await supabaseAdmin.from('withdrawals').update({
      receipt_url: url,
      receipt_sent_at: new Date().toISOString(),
    }).eq('id', withdrawalId);
    if (updateRes.error) return NextResponse.json({ error: 'db_error', detail: updateRes.error.message }, { status: 500 });

    return NextResponse.json({ ok: true, url });
  } catch (err) {
    return NextResponse.json({ error: 'unexpected', detail: String(err?.message || err) }, { status: 500 });
  }
}
