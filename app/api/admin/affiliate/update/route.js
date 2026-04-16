import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../../lib/supabase-admin';
import { requireAdmin } from '../../../../../lib/auth';

export const dynamic = 'force-dynamic';

const ALLOWED_FIELDS = [
  'name', 'email', 'phone', 'tier', 'commission_value', 'commission_type',
  'is_admin', 'is_sponsored', 'blocked', 'admin_notes', 'active', 'avatar_url',
];

export async function POST(request) {
  const auth = await requireAdmin(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'invalid_body' }, { status: 400 }); }

  const affiliateId = String(body?.affiliate_id || '').trim();
  if (!affiliateId) return NextResponse.json({ error: 'missing_affiliate_id' }, { status: 400 });

  const updates = {};
  for (const field of ALLOWED_FIELDS) {
    if (body[field] !== undefined) {
      if (typeof body[field] === 'boolean') updates[field] = body[field];
      else if (typeof body[field] === 'number') updates[field] = body[field];
      else updates[field] = String(body[field]).slice(0, 500);
    }
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no_changes' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('affiliates')
    .update(updates)
    .eq('id', affiliateId)
    .select('*');

  if (error) return NextResponse.json({ error: 'db_error', details: error.message }, { status: 500 });
  return NextResponse.json({ ok: true, affiliate: data?.[0] });
}
