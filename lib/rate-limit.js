import { supabaseAdmin } from './supabase-admin.js';

export function getClientIp(request) {
  const xff = request.headers.get('x-forwarded-for');
  if (xff) return xff.split(',')[0].trim();
  return request.headers.get('x-real-ip') || 'unknown';
}

export async function logAttempt({ ip, coupon, success }) {
  try {
    await supabaseAdmin.from('login_attempts').insert({
      ip: ip || 'unknown',
      coupon: coupon ? coupon.toUpperCase().slice(0, 40) : null,
      success: !!success,
    });
  } catch {}
}

export async function checkRateLimit({ ip, coupon }) {
  const now = Date.now();
  const fiveMinAgo = new Date(now - 5 * 60 * 1000).toISOString();
  const fifteenMinAgo = new Date(now - 15 * 60 * 1000).toISOString();

  try {
    const ipCheck = await supabaseAdmin
      .from('login_attempts')
      .select('id', { count: 'exact', head: true })
      .eq('ip', ip)
      .eq('success', false)
      .gte('created_at', fiveMinAgo);
    if ((ipCheck.count || 0) >= 10) {
      return { blocked: true, reason: 'ip_rate_limit', retry_in: 300 };
    }

    if (coupon) {
      const couponCheck = await supabaseAdmin
        .from('login_attempts')
        .select('id', { count: 'exact', head: true })
        .ilike('coupon', coupon)
        .eq('success', false)
        .gte('created_at', fifteenMinAgo);
      if ((couponCheck.count || 0) >= 5) {
        return { blocked: true, reason: 'coupon_rate_limit', retry_in: 900 };
      }
    }
  } catch {}

  return { blocked: false };
}
