import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/auth';
import { supabaseAdmin } from '../../../../../lib/supabase-admin';
import { sendEmail, emailEnabled, buildRewardWinnerEmail } from '../../../../../lib/email';

export const dynamic = 'force-dynamic';

async function syncWinners() {
  var [rewardsRes, metricsRes] = await Promise.all([
    supabaseAdmin.from('rewards').select('*').eq('active', true),
    supabaseAdmin.from('affiliate_metrics').select('*'),
  ]);
  var rewards = rewardsRes.data || [];
  var metrics = metricsRes.data || [];

  var inserts = [];
  for (var i = 0; i < rewards.length; i++) {
    var r = rewards[i];
    var target = Number(r.target_value);
    for (var j = 0; j < metrics.length; j++) {
      var m = metrics[j];
      var current = r.target_type === 'sales' ? Number(m.total_sales || 0) : Number(m.total_earned || 0);
      if (current >= target) {
        inserts.push({ reward_id: r.id, affiliate_id: m.id });
      }
    }
  }

  if (inserts.length > 0) {
    await supabaseAdmin.from('reward_winners').upsert(inserts, { onConflict: 'reward_id,affiliate_id', ignoreDuplicates: true });
  }
}

export async function GET(request) {
  var session = await requireAdmin(request);
  if (session.error) return NextResponse.json({ error: session.error }, { status: session.status });

  try { await syncWinners(); } catch (e) {}

  var { data, error } = await supabaseAdmin
    .from('reward_winners')
    .select('*, rewards(id, reward_title, reward_description, reward_emoji, reward_value_money, target_type, target_value), affiliates(id, name, coupon_code, avatar_initials, avatar_url, email, whatsapp, phone, deleted_at)')
    .order('achieved_at', { ascending: false });

  if (error) return NextResponse.json({ error: 'db_error', detail: error.message }, { status: 500 });

  var rows = (data || []).filter(function(w) { return w.affiliates && !w.affiliates.deleted_at && w.rewards; });
  return NextResponse.json({ ok: true, winners: rows });
}

export async function POST(request) {
  var session = await requireAdmin(request);
  if (session.error) return NextResponse.json({ error: session.error }, { status: session.status });

  var body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  var winnerId = body && body.winner_id;
  if (!winnerId) return NextResponse.json({ error: 'missing_winner_id' }, { status: 400 });

  var { data: winner, error: fetchErr } = await supabaseAdmin
    .from('reward_winners')
    .select('*, rewards(reward_title, reward_description, reward_emoji, reward_value_money, target_type, target_value), affiliates(name, coupon_code, email)')
    .eq('id', winnerId)
    .maybeSingle();

  if (fetchErr) return NextResponse.json({ error: 'db_error', detail: fetchErr.message }, { status: 500 });
  if (!winner) return NextResponse.json({ error: 'not_found' }, { status: 404 });
  if (!winner.affiliates || !winner.affiliates.email) return NextResponse.json({ error: 'no_email' }, { status: 400 });

  var r = winner.rewards;
  if (!r) return NextResponse.json({ error: 'reward_not_found' }, { status: 404 });

  var targetLabel = r.target_type === 'sales'
    ? Number(r.target_value) + ' vendas'
    : 'R$ ' + Number(r.target_value).toFixed(2).replace('.', ',');

  var emailSent = false;
  var emailError = null;
  if (emailEnabled) {
    try {
      var msg = buildRewardWinnerEmail({
        name: winner.affiliates.name,
        rewardTitle: r.reward_title,
        rewardEmoji: r.reward_emoji,
        rewardDescription: r.reward_description,
        targetLabel: targetLabel,
        bonusMoney: r.reward_value_money,
      });
      var sendRes = await sendEmail({ to: winner.affiliates.email, subject: msg.subject, html: msg.html });
      emailSent = !!(sendRes && sendRes.ok);
      if (!emailSent) emailError = (sendRes && sendRes.error) || 'unknown';
    } catch (e) { emailError = e && e.message ? e.message : String(e); }
  } else {
    emailError = 'email_not_configured';
  }

  await supabaseAdmin
    .from('reward_winners')
    .update({ notified_at: new Date().toISOString(), notified_by: session.affiliate.id })
    .eq('id', winnerId);

  return NextResponse.json({ ok: true, email_sent: emailSent, email_error: emailError });
}
