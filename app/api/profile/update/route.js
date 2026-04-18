import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';
import { requireSession, hashPassword } from '../../../../lib/auth';

export const dynamic = 'force-dynamic';

const ALLOWED_FIELDS = ['name', 'email', 'phone', 'avatar_url'];

export async function POST(request) {
  const auth = await requireSession(request);
  if (auth.error) return NextResponse.json({ error: auth.error }, { status: auth.status });

  let body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'invalid_body' }, { status: 400 }); }

  const updates = {};
  for (const field of ALLOWED_FIELDS) {
    if (body[field] !== undefined && body[field] !== null) {
      updates[field] = String(body[field]).slice(0, 300).trim();
    }
  }

  if (updates.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(updates.email)) {
    return NextResponse.json({ error: 'invalid_email' }, { status: 400 });
  }

  if (updates.name !== undefined && updates.name.length < 2) {
    return NextResponse.json({ error: 'name_too_short' }, { status: 400 });
  }

  if (body.password && String(body.password).trim()) {
    const pwd = String(body.password).trim();
    if (!/^\d{6,10}$/.test(pwd)) {
      return NextResponse.json({ error: 'password_must_be_6_to_10_digits' }, { status: 400 });
    }
    updates.password_hash = await hashPassword(pwd);
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'no_changes' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('affiliates')
    .update(updates)
    .eq('id', auth.affiliate.id)
    .select('id, name, coupon_code, email, phone, avatar_url, is_admin');

  if (error) {
    const msg = String(error.message || '').toLowerCase();
    if (msg.includes('duplicate') || msg.includes('unique') || error.code === '23505') {
      if (msg.includes('email')) return NextResponse.json({ error: 'email_taken' }, { status: 409 });
      return NextResponse.json({ error: 'duplicate' }, { status: 409 });
    }
    return NextResponse.json({ error: 'db_error', detail: error.message }, { status: 500 });
  }
  if (!data || data.length === 0) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  return NextResponse.json({ ok: true, affiliate: data[0] });
}
