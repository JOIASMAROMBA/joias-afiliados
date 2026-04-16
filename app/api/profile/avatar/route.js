import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requireSession } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

const MAX_SIZE = 5 * 1024 * 1024;

function detectImageType(buf) {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { mime: 'image/jpeg', ext: 'jpg' };
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47 && buf[4] === 0x0d && buf[5] === 0x0a && buf[6] === 0x1a && buf[7] === 0x0a) return { mime: 'image/png', ext: 'png' };
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return { mime: 'image/gif', ext: 'gif' };
  if (buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 && buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50) return { mime: 'image/webp', ext: 'webp' };
  return null;
}

export async function POST(request) {
  try {
    const auth = await requireSession(request);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const form = await request.formData();
    const file = form.get('file');
    if (!file || typeof file.arrayBuffer !== 'function') {
      return NextResponse.json({ error: 'no_file' }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'file_too_large', max_mb: 5 }, { status: 413 });
    }

    const ab = await file.arrayBuffer();
    const buf = Buffer.from(ab);

    const detected = detectImageType(buf);
    if (!detected) {
      return NextResponse.json({ error: 'invalid_image', detail: 'only JPEG, PNG, GIF, WebP allowed' }, { status: 400 });
    }

    const fileName = auth.affiliate.id + '-' + Date.now() + '.' + detected.ext;

    const up = await supabaseAdmin.storage.from('avatars').upload(fileName, buf, {
      contentType: detected.mime,
      upsert: true,
      cacheControl: '3600',
    });
    if (up.error) {
      return NextResponse.json({ error: 'upload_failed', detail: up.error.message }, { status: 500 });
    }

    const pub = supabaseAdmin.storage.from('avatars').getPublicUrl(fileName);
    const url = pub.data.publicUrl;

    return NextResponse.json({ ok: true, url });
  } catch (err) {
    return NextResponse.json({ error: 'unexpected', detail: String(err?.message || err) }, { status: 500 });
  }
}
