import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const JWT_SECRET = (process.env.AUTH_JWT_SECRET || '').trim();
const COOKIE_NAME = 'joias_session';
const SESSION_MAX_AGE = 60 * 60 * 24 * 30;

export { COOKIE_NAME, SESSION_MAX_AGE };

export async function hashPassword(plain) {
  return bcrypt.hash(String(plain), 10);
}

export async function verifyPassword(plain, stored) {
  if (!stored) return { ok: false, needsRehash: false };
  const s = String(stored);
  const p = String(plain);
  if (s.startsWith('$2a$') || s.startsWith('$2b$') || s.startsWith('$2y$')) {
    const ok = await bcrypt.compare(p, s).catch(() => false);
    return { ok, needsRehash: false };
  }
  if (s === p) return { ok: true, needsRehash: true };
  return { ok: false, needsRehash: false };
}

export function signSession(payload) {
  if (!JWT_SECRET) throw new Error('AUTH_JWT_SECRET is required');
  return jwt.sign(payload, JWT_SECRET, { expiresIn: '30d' });
}

export function verifySession(token) {
  if (!token || !JWT_SECRET) return null;
  try {
    return jwt.verify(token, JWT_SECRET);
  } catch {
    return null;
  }
}

export function getSessionFromRequest(request) {
  const cookie = request.cookies.get(COOKIE_NAME);
  if (!cookie) return null;
  return verifySession(cookie.value);
}

export async function requireSession(request) {
  const session = getSessionFromRequest(request);
  if (!session?.id) return { error: 'unauthorized', status: 401 };
  const { supabaseAdmin } = await import('./supabase-admin.js');
  const { data: affiliate } = await supabaseAdmin
    .from('affiliates')
    .select('id, name, coupon_code, is_admin, blocked')
    .eq('id', session.id)
    .maybeSingle();
  if (!affiliate || affiliate.blocked) return { error: 'invalid_session', status: 401 };
  return { session, affiliate };
}

export async function requireAdmin(request) {
  const result = await requireSession(request);
  if (result.error) return result;
  if (!result.affiliate.is_admin) return { error: 'forbidden', status: 403 };
  return result;
}
