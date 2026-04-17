import webpush from 'web-push';
import { supabaseAdmin } from './supabase-admin';

var configured = false;
function ensureConfigured() {
  if (configured) return true;
  var pub = process.env.VAPID_PUBLIC_KEY || process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  var priv = process.env.VAPID_PRIVATE_KEY;
  var subject = process.env.VAPID_SUBJECT || 'mailto:renanforumn@gmail.com';
  if (!pub || !priv) return false;
  webpush.setVapidDetails(subject, pub, priv);
  configured = true;
  return true;
}

export async function sendPushToAffiliate(affiliateId, payload) {
  if (!ensureConfigured()) return { ok: false, skipped: 'vapid not configured' };
  if (!affiliateId) return { ok: false, skipped: 'no affiliate id' };

  var { data: subs, error } = await supabaseAdmin
    .from('push_subscriptions')
    .select('*')
    .eq('affiliate_id', affiliateId);

  if (error) return { ok: false, error: error.message };
  if (!subs || subs.length === 0) return { ok: true, sent: 0 };

  var body = JSON.stringify(payload || {});
  var deadIds = [];
  var sent = 0;

  for (var i = 0; i < subs.length; i++) {
    var s = subs[i];
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        body
      );
      sent++;
    } catch (err) {
      var sc = err && err.statusCode;
      if (sc === 404 || sc === 410) deadIds.push(s.id);
    }
  }

  if (deadIds.length > 0) {
    try { await supabaseAdmin.from('push_subscriptions').delete().in('id', deadIds); } catch (e) {}
  }

  try {
    await supabaseAdmin
      .from('push_subscriptions')
      .update({ last_sent_at: new Date().toISOString() })
      .eq('affiliate_id', affiliateId);
  } catch (e) {}

  return { ok: true, sent: sent, removed: deadIds.length };
}
