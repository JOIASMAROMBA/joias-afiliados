import { NextResponse } from 'next/server';
import { supabaseAdmin } from '../../../../lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const coupon = String(searchParams.get('coupon') || '').trim();

    if (coupon.length < 3) {
      return NextResponse.json({ available: false, reason: 'min_length' });
    }
    if (coupon.length > 40 || !/^[A-Z0-9]+$/.test(coupon)) {
      return NextResponse.json({ available: false, reason: 'invalid_format' });
    }

    const { data } = await supabaseAdmin
      .from('affiliates')
      .select('id')
      .ilike('coupon_code', coupon)
      .maybeSingle();

    return NextResponse.json({ available: !data });
  } catch {
    return NextResponse.json({ available: false, reason: 'error' }, { status: 500 });
  }
}
