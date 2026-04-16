import { Resend } from 'resend';

const apiKey = (process.env.RESEND_API_KEY || '').trim();
const fromAddress = (process.env.EMAIL_FROM || 'Joias Maromba <onboarding@resend.dev>').trim();

export const emailEnabled = Boolean(apiKey);
const resend = apiKey ? new Resend(apiKey) : null;

export async function sendEmail({ to, subject, html }) {
  if (!resend) return { ok: false, error: 'email_not_configured' };
  try {
    const result = await resend.emails.send({
      from: fromAddress,
      to: [to],
      subject,
      html,
    });
    if (result.error) return { ok: false, error: result.error.message };
    return { ok: true, id: result.data?.id };
  } catch (err) {
    return { ok: false, error: String(err?.message || err) };
  }
}

export function buildResetPasswordEmail({ name, coupon, provisionalPassword }) {
  const firstName = (name || '').split(' ')[0] || 'Afiliada';
  return {
    subject: 'Joias Maromba — Senha provisória',
    html: `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><title>Senha Provisória</title></head>
<body style="margin:0;padding:0;font-family:Arial,Helvetica,sans-serif;background:#0a0a0a;color:#fff;">
  <div style="max-width:500px;margin:40px auto;padding:30px;background:linear-gradient(180deg,#1a0a2e,#0a0a0a);border:1px solid #FFD700;border-radius:16px;">
    <div style="text-align:center;margin-bottom:24px;">
      <div style="font-size:48px;">💎</div>
      <h1 style="color:#FFD700;margin:8px 0;font-size:22px;">Joias Maromba</h1>
      <div style="color:rgba(255,215,0,0.7);font-size:13px;">Painel de Afiliadas</div>
    </div>
    <p style="font-size:15px;line-height:1.6;">Olá ${firstName},</p>
    <p style="font-size:14px;line-height:1.6;color:rgba(255,255,255,0.8);">
      Você solicitou a recuperação da senha do seu painel. Sua nova senha provisória é:
    </p>
    <div style="text-align:center;margin:28px 0;">
      <div style="display:inline-block;background:linear-gradient(135deg,#FFD700,#FFA500);color:#1a0a2e;font-size:32px;font-weight:900;letter-spacing:10px;padding:16px 36px;border-radius:12px;">
        ${provisionalPassword}
      </div>
    </div>
    <p style="font-size:13px;color:rgba(255,215,0,0.8);line-height:1.6;">
      <strong>Cupom:</strong> ${coupon}<br>
      <strong>Senha:</strong> ${provisionalPassword}
    </p>
    <p style="font-size:13px;line-height:1.6;color:rgba(255,255,255,0.7);margin-top:20px;">
      Por segurança, <strong style="color:#FFD700;">troque essa senha assim que entrar</strong> no painel em Editar Perfil.
    </p>
    <hr style="border:none;border-top:1px solid rgba(255,215,0,0.2);margin:24px 0;">
    <p style="font-size:11px;color:rgba(255,255,255,0.4);text-align:center;">
      Se não foi você que pediu, ignore esse email — mas avise imediatamente o suporte.
    </p>
  </div>
</body>
</html>`,
  };
}
