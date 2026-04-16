import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requireSession } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

const ALLOWED_PLATFORMS = ['instagram', 'tiktok', 'facebook', 'outro'];

export async function POST(request) {
  try {
    const auth = await requireSession(request);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });
    const body = await request.json().catch(() => ({}));

    const platform = String(body?.platform || '').trim().toLowerCase();
    const postLink = String(body?.post_link || '').trim().slice(0, 500);

    if (!ALLOWED_PLATFORMS.includes(platform)) {
      return NextResponse.json({ error: 'invalid_platform' }, { status: 400 });
    }
    if (!postLink || postLink.length < 3) {
      return NextResponse.json({ error: 'invalid_link' }, { status: 400 });
    }

    const now = new Date();
    const { error } = await supabaseAdmin.from('posts').insert({
      affiliate_id: auth.affiliate.id,
      post_type: platform,
      platform,
      post_id: postLink,
      post_url: postLink,
      week_number: Math.ceil(now.getDate() / 7),
      year: now.getFullYear(),
    });
    if (error) return NextResponse.json({ error: 'db_error', detail: error.message }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: 'unexpected', detail: String(err?.message || err) }, { status: 500 });
  }
}
