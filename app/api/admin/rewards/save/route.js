import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase-admin';
import { requireAdmin } from '../../../../../lib/auth';

export const dynamic = 'force-dynamic';

const ALLOWED = ['target_type', 'target_value', 'reward_title', 'reward_description', 'reward_emoji', 'reward_value_money', 'active', 'order_position', 'audience'];
const VALID_AUDIENCE = ['affiliate', 'sponsored', 'both'];

export async function POST(request) {
  try {
    const auth = await requireAdmin(request);
    if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

    let body;
    try { body = await request.json(); } catch { return NextResponse.json({ error: 'invalid_body' }, { status: 400 }); }

    const rewardId = body?.id ? String(body.id) : null;
    const payload = {};
    for (const k of ALLOWED) {
      if (body[k] !== undefined) payload[k] = body[k];
    }

    if (!payload.target_type || !payload.target_value || !payload.reward_title) {
      return NextResponse.json({ error: 'missing_fields' }, { status: 400 });
    }
    if (payload.audience !== undefined && !VALID_AUDIENCE.includes(payload.audience)) {
      return NextResponse.json({ error: 'invalid_audience' }, { status: 400 });
    }

    let result;
    if (rewardId) {
      result = await supabaseAdmin.from('rewards').update(payload).eq('id', rewardId).select();
    } else {
      result = await supabaseAdmin.from('rewards').insert(payload).select();
    }
    if (result.error) return NextResponse.json({ error: 'db_error', detail: result.error.message }, { status: 500 });
    return NextResponse.json({ ok: true, reward: result.data?.[0] });
  } catch (err) {
    return NextResponse.json({ error: 'unexpected', detail: String(err?.message || err) }, { status: 500 });
  }
}
