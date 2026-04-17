import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/auth';
import { supabaseAdmin } from '../../../../../lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET(request) {
  var session = await requireAdmin(request);
  if (session.error) return NextResponse.json({ error: session.error }, { status: session.status });

  var url = new URL(request.url);
  var affiliateId = url.searchParams.get('affiliate_id');
  if (!affiliateId) return NextResponse.json({ error: 'missing_affiliate_id' }, { status: 400 });

  var sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

  var [afRes, salesRes, wdRes, postsRes, notifRes, auditRes] = await Promise.all([
    supabaseAdmin.from('affiliates').select('*').eq('id', affiliateId).maybeSingle(),
    supabaseAdmin.from('sales').select('*').eq('affiliate_id', affiliateId).gte('created_at', sixtyDaysAgo).order('created_at', { ascending: false }).limit(500),
    supabaseAdmin.from('withdrawals').select('*').eq('affiliate_id', affiliateId).gte('created_at', sixtyDaysAgo).order('created_at', { ascending: false }).limit(200),
    supabaseAdmin.from('posts').select('*').eq('affiliate_id', affiliateId).gte('created_at', sixtyDaysAgo).order('created_at', { ascending: false }).limit(300),
    supabaseAdmin.from('notifications').select('*').eq('affiliate_id', affiliateId).gte('created_at', sixtyDaysAgo).order('created_at', { ascending: false }).limit(200).then(function(r) { return r; }, function() { return { data: [] }; }),
    supabaseAdmin.from('audit_log').select('*').eq('affiliate_id', affiliateId).gte('created_at', sixtyDaysAgo).order('created_at', { ascending: false }).limit(500).then(function(r) { return r; }, function() { return { data: [] }; }),
  ]);

  if (!afRes.data) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  var balanceRes = await supabaseAdmin.from('affiliate_balance').select('*').eq('id', affiliateId).maybeSingle();

  var totals = {
    sales_count: (salesRes.data || []).length,
    sales_commission: (salesRes.data || []).reduce(function(s, r) { return s + Number(r.commission_earned || 0); }, 0),
    withdrawals_total: (wdRes.data || []).reduce(function(s, r) { return s + Number(r.amount || 0); }, 0),
    withdrawals_paid: (wdRes.data || []).filter(function(r) { return r.status === 'paid'; }).reduce(function(s, r) { return s + Number(r.amount || 0); }, 0),
    withdrawals_pending: (wdRes.data || []).filter(function(r) { return r.status === 'pending'; }).reduce(function(s, r) { return s + Number(r.amount || 0); }, 0),
    posts_count: (postsRes.data || []).length,
  };

  return NextResponse.json({
    ok: true,
    affiliate: afRes.data,
    balance: balanceRes.data || { available_balance: 0, blocked_balance: 0, pending_withdrawals: 0 },
    totals_60d: totals,
    sales: salesRes.data || [],
    withdrawals: wdRes.data || [],
    posts: postsRes.data || [],
    notifications: (notifRes && notifRes.data) || [],
    audit: (auditRes && auditRes.data) || [],
  });
}
