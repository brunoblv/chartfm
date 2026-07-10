/**
 * Email templates renderizados em HTML puro.
 * Tudo com estilos inline e layout em tabela: clientes de email (Gmail, Outlook)
 * removem <style> do <head>, ignoram flexbox/gradiente e não renderizam SVG inline,
 * então nada disso pode depender de CSS externo para aparecer corretamente.
 */

const LOGO_URL = "https://chartfm.com.br/logo-email.png";
const BRAND_COLOR = "#FA243C";
const ACCENT_TINT = "#FEE9EB";
const TEXT_DARK = "#1d1d1f";
const TEXT_MUTED = "#6e6e73";
const TEXT_FAINT = "#98989d";
const BORDER_COLOR = "#e5e5ea";

const LOGO_HEADER = `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td align="center" style="padding: 32px 0 24px">
      <img src="${LOGO_URL}" width="36" height="36" alt="ChartFM" style="display: block; border-radius: 8px">
    </td>
  </tr>
</table>
`;

function icon(emoji: string): string {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 0 auto 22px">
  <tr>
    <td width="64" height="64" align="center" valign="middle" bgcolor="${ACCENT_TINT}" style="width: 64px; height: 64px; border-radius: 32px; font-size: 28px; line-height: 64px;">
      ${emoji}
    </td>
  </tr>
</table>
`;
}

function button(url: string, label: string): string {
  return `
<table role="presentation" cellpadding="0" cellspacing="0" border="0" align="center" style="margin: 0 auto">
  <tr>
    <td align="center" bgcolor="${BRAND_COLOR}" style="border-radius: 12px;">
      <a href="${escapeHtml(url)}" target="_blank" style="display: inline-block; padding: 15px 40px; font-family: -apple-system, 'SF Pro Display', 'Inter', system-ui, sans-serif; font-size: 15px; font-weight: 700; color: #ffffff !important; text-decoration: none; letter-spacing: -0.01em;"><span style="color: #ffffff !important;">${escapeHtml(label)}</span></a>
    </td>
  </tr>
</table>
`;
}

function footerLinks(): string {
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td align="center" style="padding-top: 24px; font-size: 12px; color: ${TEXT_FAINT}; line-height: 1.7; font-family: -apple-system, 'SF Pro Display', 'Inter', system-ui, sans-serif;">
      ChartFM &middot; Você recebeu este e-mail porque se cadastrou com esta conta<br>
      <a href="https://chartfm.com.br/support" style="color: ${TEXT_FAINT}; text-decoration: none;">Ajuda</a> &middot;
      <a href="https://chartfm.com.br/privacy-policy" style="color: ${TEXT_FAINT}; text-decoration: none;">Privacidade</a> &middot;
      <a href="https://chartfm.com.br/terms-of-use" style="color: ${TEXT_FAINT}; text-decoration: none;">Termos</a>
    </td>
  </tr>
</table>
`;
}

function emailShell(content: string): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="color-scheme" content="light">
  <meta name="supported-color-schemes" content="light">
</head>
<body style="font-family: -apple-system, 'SF Pro Display', 'Inter', system-ui, sans-serif; margin: 0; padding: 0; background-color: #f2f2f4;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#f2f2f4">
  <tr>
    <td align="center" style="padding: 0 16px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width: 600px; max-width: 600px; margin: 0 auto;">
        <tr>
          <td>
            ${content}
          </td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</body>
</html>
  `.trim();
}

function heading(text: string): string {
  return `<div style="font-size: 26px; font-weight: 800; color: ${TEXT_DARK}; margin: 0 0 12px; letter-spacing: -0.03em; font-family: -apple-system, 'SF Pro Display', 'Inter', system-ui, sans-serif;">${text}</div>`;
}

function paragraph(text: string): string {
  return `<div style="font-size: 15px; color: ${TEXT_MUTED}; margin: 0 0 28px; line-height: 1.6; font-family: -apple-system, 'SF Pro Display', 'Inter', system-ui, sans-serif;">${text}</div>`;
}

function expiryNote(text: string): string {
  return `<div style="font-size: 12.5px; color: ${TEXT_FAINT}; margin: 22px 0 0; line-height: 1.5; font-family: -apple-system, 'SF Pro Display', 'Inter', system-ui, sans-serif;">${text}</div>`;
}

function copyLinkBlock(url: string): string {
  return `
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td style="border-top: 1px solid #ededf0; padding: 18px 48px; font-size: 12px; color: ${TEXT_FAINT}; text-align: center; line-height: 1.6; font-family: -apple-system, 'SF Pro Display', 'Inter', system-ui, sans-serif;">
      O botão não funcionou? Copie e cole este link no navegador:<br>
      <a href="${escapeHtml(url)}" style="color: ${BRAND_COLOR}; text-decoration: none; word-break: break-all;">${escapeHtml(url.substring(0, 50))}...</a>
    </td>
  </tr>
</table>
`;
}

export function emailVerificationTemplate(params: { name: string; verifyUrl: string }): string {
  const content = `
${LOGO_HEADER}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td style="border-radius: 18px; border: 1px solid ${BORDER_COLOR}; overflow: hidden;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="background-color: #ffffff;">
        <tr>
          <td style="height: 6px; background-color: ${BRAND_COLOR}; font-size: 0; line-height: 0;">&nbsp;</td>
        </tr>
        <tr>
          <td align="center" style="padding: 44px 48px 40px;">
            ${icon("📧")}
            ${heading("Confirme seu e-mail")}
            ${paragraph(`Olá, <strong>${escapeHtml(params.name)}</strong>! Sua conta no ChartFM está quase pronta. Confirme seu endereço de e-mail para entrar nas paradas e comunidades.`)}
            ${button(params.verifyUrl, "Confirmar e-mail")}
            ${expiryNote("O link expira em <strong>24 horas</strong>. Se você não criou esta conta, ignore este e-mail.")}
          </td>
        </tr>
      </table>
      ${copyLinkBlock(params.verifyUrl)}
    </td>
  </tr>
</table>
${footerLinks()}
  `;

  return emailShell(content);
}

export function emailVerificationResendTemplate(params: { name: string; verifyUrl: string }): string {
  const content = `
${LOGO_HEADER}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td style="border-radius: 18px; border: 1px solid ${BORDER_COLOR}; overflow: hidden;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="background-color: #ffffff;">
        <tr>
          <td style="height: 6px; background-color: ${BRAND_COLOR}; font-size: 0; line-height: 0;">&nbsp;</td>
        </tr>
        <tr>
          <td align="center" style="padding: 44px 48px 40px;">
            ${icon("🔄")}
            ${heading("Aqui está seu novo link")}
            ${paragraph(`Olá, <strong>${escapeHtml(params.name)}</strong>! Você pediu o reenvio do e-mail de confirmação. Use o botão abaixo, o link anterior deixou de valer.`)}
            ${button(params.verifyUrl, "Confirmar e-mail")}
            ${expiryNote("Válido por <strong>24 horas</strong>. Não foi você quem pediu? Ignore este e-mail, sua conta continua segura.")}
          </td>
        </tr>
      </table>
      ${copyLinkBlock(params.verifyUrl)}
    </td>
  </tr>
</table>
${footerLinks()}
  `;

  return emailShell(content);
}

export function passwordResetTemplate(params: { name: string; resetUrl: string }): string {
  const content = `
${LOGO_HEADER}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">
  <tr>
    <td style="border-radius: 18px; border: 1px solid ${BORDER_COLOR}; overflow: hidden;">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ffffff" style="background-color: #ffffff;">
        <tr>
          <td style="height: 6px; background-color: ${BRAND_COLOR}; font-size: 0; line-height: 0;">&nbsp;</td>
        </tr>
        <tr>
          <td align="center" style="padding: 44px 48px 40px;">
            ${icon("🔒")}
            ${heading("Redefina sua senha")}
            ${paragraph(`Olá, <strong>${escapeHtml(params.name)}</strong>! Recebemos um pedido para redefinir a senha da sua conta. Clique no botão abaixo para criar uma nova senha.`)}
            ${button(params.resetUrl, "Criar nova senha")}
            ${expiryNote("O link expira em <strong>1 hora</strong> e só pode ser usado uma vez.<br>Não foi você? Ignore este e-mail, sua senha atual continua valendo.")}
          </td>
        </tr>
      </table>
      ${copyLinkBlock(params.resetUrl)}
    </td>
  </tr>
</table>
${footerLinks()}
  `;

  return emailShell(content);
}

function escapeHtml(text: string): string {
  const map: Record<string, string> = {
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#039;",
  };
  return text.replace(/[&<>"']/g, (char) => map[char]);
}
