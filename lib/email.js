import { Resend } from 'resend';

const apiKey = (process.env.RESEND_API_KEY || '').trim();
const fromAddress = (process.env.EMAIL_FROM || 'Joias Maromba <onboarding@resend.dev>').trim();
const LOGO_URL = (process.env.EMAIL_LOGO_URL || 'https://joias-afiliados-12hf.vercel.app/logo.png').trim();

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

export function buildEmailShell(innerHtml) {
  return `<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"></head>
<body style="margin:0;padding:0;background:#000;font-family:Arial,Helvetica,sans-serif;color:#fff;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#000;padding:24px 12px;">
    <tr><td align="center">
      <table role="presentation" width="560" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;background:#0a0a0a;border:1px solid rgba(201,169,97,0.35);border-radius:16px;overflow:hidden;">
        <tr>
          <td style="background:#000;padding:26px 24px;text-align:center;border-bottom:1px solid rgba(201,169,97,0.25);">
            <img src="${LOGO_URL}" alt="Joias Maromba" width="70" style="display:block;margin:0 auto 10px;border-radius:50%;" />
            <div style="color:#C9A961;font-size:11px;font-weight:800;letter-spacing:4px;text-transform:uppercase;">Programa de Afiliados</div>
          </td>
        </tr>
        <tr><td style="padding:28px 28px 20px;">
          ${innerHtml}
        </td></tr>
        <tr><td style="padding:16px 24px 22px;border-top:1px solid rgba(201,169,97,0.15);text-align:center;">
          <div style="color:rgba(201,169,97,0.45);font-size:10px;letter-spacing:2px;text-transform:uppercase;">Joias Maromba · Programa de Afiliados</div>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

export function buildResetPasswordEmail({ name, coupon, provisionalPassword }) {
  const firstName = (name || '').split(' ')[0] || 'Afiliada';
  const inner = `
    <p style="font-size:15px;line-height:1.6;color:#fff;margin:0 0 10px;">Olá ${firstName},</p>
    <p style="font-size:14px;line-height:1.6;color:rgba(255,255,255,0.8);margin:0 0 18px;">
      Você solicitou a recuperação da senha do seu painel. Sua nova senha provisória é:
    </p>
    <div style="text-align:center;margin:22px 0;">
      <div style="display:inline-block;background:linear-gradient(135deg,#FFD700,#C9A961);color:#000;font-size:28px;font-weight:900;letter-spacing:8px;padding:16px 32px;border-radius:12px;">
        ${provisionalPassword}
      </div>
    </div>
    <div style="background:rgba(201,169,97,0.08);border:1px solid rgba(201,169,97,0.3);border-radius:10px;padding:12px 14px;margin:18px 0;">
      <div style="font-size:12px;color:#C9A961;margin-bottom:4px;">SEU CUPOM</div>
      <div style="font-size:14px;color:#fff;font-family:monospace;letter-spacing:2px;">${coupon}</div>
    </div>
    <p style="font-size:13px;line-height:1.6;color:rgba(255,255,255,0.7);margin:14px 0 0;">
      Por segurança, <strong style="color:#C9A961;">troque essa senha assim que entrar</strong> no painel em Editar Perfil.
    </p>
    <p style="font-size:11px;color:rgba(255,255,255,0.45);text-align:center;margin-top:22px;">
      Se não foi você, ignore esse email e avise o suporte.
    </p>
  `;
  return { subject: 'Joias Maromba — Senha provisória', html: buildEmailShell(inner) };
}

export function buildRewardWinnerEmail({ name, rewardTitle, rewardEmoji, rewardDescription, targetLabel, bonusMoney }) {
  const firstName = (name || '').split(' ')[0] || 'Afiliada';
  const bonusStr = bonusMoney && Number(bonusMoney) > 0 ? 'R$ ' + Number(bonusMoney).toFixed(2).replace('.', ',') : null;
  const inner = `
    <div style="text-align:center;margin-bottom:18px;">
      <div style="font-size:56px;line-height:1;">${rewardEmoji || '🎉'}</div>
      <div style="color:#C9A961;font-size:11px;letter-spacing:4px;font-weight:900;text-transform:uppercase;margin-top:8px;">Parabéns!</div>
      <h1 style="color:#FFD700;font-size:24px;margin:8px 0 4px;font-weight:900;">Você atingiu uma meta!</h1>
    </div>
    <p style="font-size:15px;line-height:1.6;color:#fff;margin:0 0 10px;">Oi ${firstName},</p>
    <p style="font-size:14px;line-height:1.6;color:rgba(255,255,255,0.85);margin:0 0 18px;">
      Seu trabalho valeu a pena! Você conquistou a recompensa <strong style="color:#C9A961;">${rewardTitle}</strong>.
    </p>
    <div style="background:linear-gradient(135deg,rgba(255,215,0,0.15),rgba(201,169,97,0.1));border:1px solid rgba(255,215,0,0.5);border-radius:12px;padding:18px;margin:14px 0 18px;text-align:center;">
      <div style="font-size:11px;color:#FFD700;letter-spacing:2px;text-transform:uppercase;font-weight:800;margin-bottom:6px;">Meta atingida</div>
      <div style="font-size:18px;font-weight:800;color:#fff;margin-bottom:8px;">${targetLabel}</div>
      ${rewardDescription ? `<div style="font-size:13px;color:rgba(255,255,255,0.75);margin-bottom:10px;">${rewardDescription}</div>` : ''}
      ${bonusStr ? `<div style="margin-top:12px;padding:10px;background:rgba(16,185,129,0.12);border:1px solid rgba(16,185,129,0.35);border-radius:8px;"><div style="font-size:10px;color:#86EFAC;font-weight:700;letter-spacing:1.5px;text-transform:uppercase;">Bonus em dinheiro</div><div style="font-size:20px;font-weight:900;color:#10B981;margin-top:2px;">${bonusStr}</div></div>` : ''}
    </div>
    <p style="font-size:13px;line-height:1.6;color:rgba(255,255,255,0.75);margin:14px 0 0;">Nossa equipe vai entrar em contato com os próximos passos para entregar seu prêmio. Fica ligada no WhatsApp.</p>
    <p style="font-size:12px;color:rgba(255,255,255,0.5);margin-top:22px;text-align:center;">Continue assim! 💎</p>
  `;
  return { subject: 'Joias Maromba — Parabéns! Você ganhou: ' + rewardTitle, html: buildEmailShell(inner) };
}

export function buildAdminCodeEmail({ code, ip, userAgent }) {
  const inner = `
    <div style="text-align:center;margin-bottom:16px;"><div style="font-size:40px;">🔐</div><h1 style="color:#C9A961;font-size:20px;margin:6px 0;">Código de acesso admin</h1></div>
    <p style="font-size:14px;line-height:1.6;color:rgba(255,255,255,0.85);margin:0 0 16px;">
      Alguém (provavelmente você) tentou acessar o painel de administração. Para confirmar, use o código abaixo:
    </p>
    <div style="text-align:center;margin:22px 0;">
      <div style="display:inline-block;background:linear-gradient(135deg,#FFD700,#C9A961);color:#000;font-size:36px;font-weight:900;letter-spacing:12px;padding:18px 32px;border-radius:14px;">
        ${code}
      </div>
    </div>
    <p style="font-size:12px;color:rgba(255,255,255,0.65);line-height:1.6;margin:16px 0 0;">
      Este código expira em <strong style="color:#C9A961;">10 minutos</strong>.
    </p>
    <div style="background:rgba(201,169,97,0.08);border:1px solid rgba(201,169,97,0.25);border-radius:10px;padding:12px;margin:16px 0;font-size:11px;color:rgba(255,255,255,0.7);line-height:1.6;">
      ${ip ? `<div><strong style="color:#C9A961;">IP:</strong> ${ip}</div>` : ''}
      ${userAgent ? `<div><strong style="color:#C9A961;">Dispositivo:</strong> ${userAgent}</div>` : ''}
    </div>
    <div style="background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.4);border-radius:10px;padding:12px;margin:14px 0 0;">
      <div style="font-size:12px;color:#FCA5A5;line-height:1.6;">
        <strong>Não foi você?</strong> Alguém tem sua senha. Não informe este código a ninguém e <strong>troque sua senha imediatamente</strong>.
      </div>
    </div>
  `;
  return { subject: 'Joias Maromba — Código de acesso admin', html: buildEmailShell(inner) };
}

export function buildWithdrawalCodeEmail({ name, coupon, code, amount, pixType, pixKey }) {
  const firstName = (name || '').split(' ')[0] || 'Afiliada';
  const valueStr = 'R$ ' + Number(amount || 0).toFixed(2).replace('.', ',');
  const inner = `
    <p style="font-size:15px;line-height:1.6;color:#fff;margin:0 0 8px;">Olá ${firstName},</p>
    <p style="font-size:14px;line-height:1.6;color:rgba(255,255,255,0.8);margin:0 0 20px;">
      Recebemos uma solicitação de saque no seu painel. Para sua segurança, confirme usando o código abaixo:
    </p>
    <div style="text-align:center;margin:22px 0;">
      <div style="display:inline-block;background:linear-gradient(135deg,#FFD700,#C9A961);color:#000;font-size:34px;font-weight:900;letter-spacing:12px;padding:18px 32px;border-radius:14px;">
        ${code}
      </div>
    </div>
    <div style="background:rgba(201,169,97,0.08);border:1px solid rgba(201,169,97,0.3);border-radius:10px;padding:14px;margin:18px 0;">
      <div style="font-size:11px;color:#C9A961;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:6px;">Detalhes da solicitação</div>
      <div style="font-size:13px;color:#fff;line-height:1.7;">
        <strong style="color:#C9A961;">Cupom:</strong> ${coupon}<br>
        <strong style="color:#C9A961;">Valor:</strong> ${valueStr}<br>
        <strong style="color:#C9A961;">Chave PIX (${pixType}):</strong> ${pixKey}
      </div>
    </div>
    <p style="font-size:12px;color:rgba(255,255,255,0.65);line-height:1.6;margin:16px 0 0;">
      Este código expira em <strong style="color:#C9A961;">10 minutos</strong>.
    </p>
    <div style="background:rgba(239,68,68,0.12);border:1px solid rgba(239,68,68,0.4);border-radius:10px;padding:12px;margin:18px 0 0;">
      <div style="font-size:12px;color:#FCA5A5;line-height:1.6;">
        <strong>Não foi você?</strong> Ignore esse email e <strong>troque sua senha imediatamente</strong> no painel. Não compartilhe esse código com ninguém.
      </div>
    </div>
  `;
  return { subject: 'Joias Maromba — Código de confirmação de saque', html: buildEmailShell(inner) };
}

export function buildApprovalEmail({ name, coupon }) {
  const firstName = (name || '').split(' ')[0] || 'Afiliada';
  const inner = `
    <div style="text-align:center;margin-bottom:18px;"><div style="font-size:44px;">🎉</div><h1 style="color:#C9A961;font-size:22px;margin:6px 0;">Cadastro aprovado!</h1></div>
    <p style="font-size:15px;line-height:1.6;color:#fff;margin:0 0 10px;">Oi ${firstName},</p>
    <p style="font-size:14px;line-height:1.6;color:rgba(255,255,255,0.85);margin:0 0 14px;">
      Parabéns! Seu cadastro no Programa de Afiliadas Joias Maromba foi <strong style="color:#C9A961;">aprovado</strong>.
      Agora você já pode começar a divulgar e receber comissões.
    </p>
    <div style="background:rgba(201,169,97,0.1);border:1px solid rgba(201,169,97,0.3);border-radius:10px;padding:16px;margin:14px 0 18px;text-align:center;">
      <div style="font-size:11px;color:#C9A961;letter-spacing:2px;text-transform:uppercase;margin-bottom:6px;">Seu cupom exclusivo</div>
      <div style="font-size:22px;font-weight:900;color:#C9A961;font-family:monospace;letter-spacing:4px;">${coupon}</div>
    </div>
    <p style="font-size:13px;line-height:1.6;color:rgba(255,255,255,0.8);margin:10px 0;">
      Compartilhe seu cupom com sua audiência e ganhe comissão por cada venda que usar sua chave.
    </p>
    <div style="text-align:center;margin-top:22px;">
      <a href="https://joias-afiliados-12hf.vercel.app/login" style="display:inline-block;padding:14px 28px;background:linear-gradient(135deg,#FFD700,#C9A961);color:#000;font-size:14px;font-weight:900;text-decoration:none;border-radius:12px;letter-spacing:1px;">ACESSAR PAINEL</a>
    </div>
    <p style="font-size:11px;color:rgba(255,255,255,0.45);text-align:center;margin-top:22px;">Boas vendas! 💎</p>
  `;
  return { subject: 'Joias Maromba — Cadastro aprovado! 🎉', html: buildEmailShell(inner) };
}

export function buildRejectionEmail({ name, reason }) {
  const firstName = (name || '').split(' ')[0] || 'Olá';
  const inner = `
    <div style="text-align:center;margin-bottom:18px;"><div style="font-size:40px;">😔</div><h1 style="color:#EF4444;font-size:20px;margin:6px 0;">Cadastro não aprovado</h1></div>
    <p style="font-size:15px;line-height:1.6;color:#fff;margin:0 0 10px;">Oi ${firstName},</p>
    <p style="font-size:14px;line-height:1.6;color:rgba(255,255,255,0.85);margin:0 0 14px;">
      Infelizmente seu cadastro no Programa de Afiliadas Joias Maromba não foi aprovado neste momento.
    </p>
    ${reason ? `<div style="background:rgba(239,68,68,0.1);border:1px solid rgba(239,68,68,0.3);border-radius:10px;padding:14px;margin:14px 0;"><div style="font-size:11px;color:#FCA5A5;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px;">Motivo</div><div style="font-size:13px;color:#fff;line-height:1.5;">${reason}</div></div>` : ''}
    <p style="font-size:13px;line-height:1.6;color:rgba(255,255,255,0.8);margin:14px 0;">
      Se você acredita que houve um engano ou gostaria de mais informações, entre em contato conosco:
    </p>
    <div style="text-align:center;margin:18px 0;">
      <a href="mailto:contato@joiasmaromba.com.br" style="display:inline-block;padding:12px 22px;background:rgba(201,169,97,0.12);color:#C9A961;font-size:13px;font-weight:800;text-decoration:none;border-radius:10px;border:1px solid rgba(201,169,97,0.4);">contato@joiasmaromba.com.br</a>
    </div>
  `;
  return { subject: 'Joias Maromba — Atualização sobre seu cadastro', html: buildEmailShell(inner) };
}

export function buildWithdrawalCreatedEmail({ name, amount, pixType, pixKey, ip }) {
  const firstName = (name || '').split(' ')[0] || 'afiliada';
  const valueStr = 'R$ ' + Number(amount || 0).toFixed(2).replace('.', ',');
  const inner = `
    <div style="text-align:center;margin-bottom:18px;"><div style="font-size:40px;">💰</div><h1 style="color:#C9A961;font-size:20px;margin:6px 0;">Saque solicitado</h1></div>
    <p style="font-size:14px;line-height:1.6;color:rgba(255,255,255,0.85);margin:0 0 8px;">Olá ${firstName},</p>
    <p style="font-size:14px;line-height:1.6;color:rgba(255,255,255,0.85);margin:0 0 18px;">Sua solicitação de saque foi registrada com sucesso:</p>
    <div style="background:rgba(201,169,97,0.08);border:1px solid rgba(201,169,97,0.3);border-radius:10px;padding:16px;margin:8px 0 18px;">
      <div style="font-size:11px;color:#C9A961;letter-spacing:1.5px;text-transform:uppercase;margin-bottom:4px;">Valor</div>
      <div style="font-size:26px;font-weight:900;color:#00ff88;">${valueStr}</div>
      <div style="font-size:12px;color:rgba(201,169,97,0.75);margin-top:10px;">Chave PIX (${pixType}): ${pixKey}</div>
      ${ip ? `<div style="font-size:11px;color:rgba(201,169,97,0.5);margin-top:6px;">IP da solicitação: ${ip}</div>` : ''}
    </div>
    <p style="font-size:13px;color:rgba(255,255,255,0.7);line-height:1.6;margin:0;">Prazo de pagamento: até 24 horas. Se não foi você, responda esse email imediatamente.</p>
  `;
  return { subject: 'Joias Maromba — Solicitação de saque recebida', html: buildEmailShell(inner) };
}
