import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/auth';
import { supabaseAdmin } from '../../../../../lib/supabase-admin';
import { sendEmail, emailEnabled, buildApprovalEmail, buildRejectionEmail } from '../../../../../lib/email';

export const dynamic = 'force-dynamic';

export async function POST(request) {
  var session = await requireAdmin(request);
  if (session.error) return NextResponse.json({ error: session.error }, { status: session.status });

  var body;
  try { body = await request.json(); } catch { return NextResponse.json({ error: 'invalid_json' }, { status: 400 }); }

  var affiliateId = body && body.affiliate_id;
  var action = body && body.action;
  var reason = body && body.reason ? String(body.reason).slice(0, 500) : null;

  if (!affiliateId) return NextResponse.json({ error: 'missing_affiliate_id' }, { status: 400 });
  if (action !== 'approve' && action !== 'reject') return NextResponse.json({ error: 'invalid_action' }, { status: 400 });

  var { data: target, error: fetchErr } = await supabaseAdmin
    .from('affiliates')
    .select('id, name, email, coupon_code, approval_status, gender')
    .eq('id', affiliateId)
    .maybeSingle();
  if (fetchErr) return NextResponse.json({ error: 'db_error', detail: fetchErr.message }, { status: 500 });
  if (!target) return NextResponse.json({ error: 'not_found' }, { status: 404 });

  var updates = action === 'approve'
    ? { approval_status: 'approved', approved_at: new Date().toISOString(), approved_by: session.affiliate.id, rejected_at: null, rejection_reason: null, approval_seen_at: null }
    : { approval_status: 'rejected', rejected_at: new Date().toISOString(), rejection_reason: reason, approved_at: null };

  var { error: updErr } = await supabaseAdmin.from('affiliates').update(updates).eq('id', affiliateId);
  if (updErr) return NextResponse.json({ error: 'update_failed', detail: updErr.message }, { status: 500 });

  var emailSent = false;
  if (emailEnabled && target.email) {
    try {
      var msg = action === 'approve'
        ? buildApprovalEmail({ name: target.name, coupon: target.coupon_code, gender: target.gender })
        : buildRejectionEmail({ name: target.name, reason: reason });
      var sendRes = await sendEmail({ to: target.email, subject: msg.subject, html: msg.html });
      emailSent = !!(sendRes && sendRes.ok);
    } catch (e) {}
  }

  return NextResponse.json({ ok: true, action: action, affiliate_id: affiliateId, email_sent: emailSent });
}
