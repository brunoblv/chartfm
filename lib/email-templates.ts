/**
 * Email templates renderizados em HTML puro.
 * Templates profissionais e responsivos.
 */

const LOGO_URL = "https://chartfm.com.br/logo-email.png";
const BRAND_COLOR = "#FA243C";
const ACCENT_TINT = "#FEE9EB";

const LOGO_HEADER = `
<div style="text-align: center; padding: 32px 0 24px">
  <img src="${LOGO_URL}" width="36" height="36" alt="ChartFM" style="display: inline-block; border-radius: 8px">
</div>
`;

function emailShell(content: string): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <style>
    body { font-family: -apple-system, "SF Pro Display", "Inter", system-ui, sans-serif; line-height: 1.6; color: #1d1d1f; margin: 0; padding: 0; background: #f2f2f4; }
    .container { max-width: 600px; margin: 40px auto; background: #fff; border-radius: 18px; border: 1px solid #e5e5ea; overflow: hidden; }
    .hero { height: 6px; background: linear-gradient(135deg, #FA243C, #FF5858); }
    .content { padding: 44px 48px 40px; text-align: center; }
    .icon { width: 64px; height: 64px; margin: 0 auto 22px; border-radius: 50%; background: ${ACCENT_TINT}; display: flex; align-items: center; justify-content: center; }
    .icon svg { width: 28px; height: 28px; }
    h1 { font-size: 26px; font-weight: 800; margin: 0 0 12px; letter-spacing: -0.03em; }
    p { font-size: 15px; color: #6e6e73; margin: 0 0 28px; line-height: 1.6; }
    .cta { display: inline-block; background: ${BRAND_COLOR}; color: #fff; font-size: 15px; font-weight: 700; text-decoration: none; padding: 15px 40px; border-radius: 12px; letter-spacing: -0.01em; }
    .footer-link { border-top: 1px solid #ededf0; padding: 18px 48px; font-size: 12px; color: #98989d; text-align: center; line-height: 1.6; }
    .footer-link a { color: ${BRAND_COLOR}; text-decoration: none; word-break: break-all; }
    .disclaimer { text-align: center; padding-top: 24px; font-size: 12px; color: #98989d; line-height: 1.7; }
    .disclaimer a { color: #98989d; text-decoration: none; }
    .expiry-note { font-size: 12.5px; color: #98989d; margin: 22px 0 0; line-height: 1.5; }
    .expiry-note strong { color: #6e6e73; }
  </style>
</head>
<body>
${content}
</body>
</html>
  `.trim();
}

export function emailVerificationTemplate(params: { name: string; verifyUrl: string }): string {
  const content = `
${LOGO_HEADER}
<div class="container">
  <div class="hero"></div>
  <div class="content">
    <div class="icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="${BRAND_COLOR}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="2" y="4" width="20" height="16" rx="3"></rect>
        <path d="M2 7l10 6 10-6"></path>
      </svg>
    </div>
    <h1>Confirme seu e-mail</h1>
    <p>Olá, <strong>${escapeHtml(params.name)}</strong>! Sua conta no ChartFM está quase pronta. Confirme seu endereço de e-mail para entrar nas paradas e comunidades.</p>
    <a href="${escapeHtml(params.verifyUrl)}" class="cta">Confirmar e-mail</a>
    <p class="expiry-note">O link expira em <strong>24 horas</strong>. Se você não criou esta conta, ignore este e-mail.</p>
  </div>
  <div class="footer-link">
    O botão não funcionou? Copie e cole este link no navegador:<br>
    <a href="${escapeHtml(params.verifyUrl)}">${escapeHtml(params.verifyUrl.substring(0, 50))}...</a>
  </div>
</div>
<div class="disclaimer">
  ChartFM · Você recebeu este e-mail porque se cadastrou com esta conta<br>
  <a href="https://chartfm.com.br/support">Ajuda</a> · <a href="https://chartfm.com.br/privacy-policy">Privacidade</a> · <a href="https://chartfm.com.br/terms-of-use">Termos</a>
</div>
  `;

  return emailShell(content);
}

export function emailVerificationResendTemplate(params: { name: string; verifyUrl: string }): string {
  const content = `
${LOGO_HEADER}
<div class="container">
  <div class="hero"></div>
  <div class="content">
    <div class="icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="${BRAND_COLOR}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 12a9 9 0 1 1-2.64-6.36"></path>
        <path d="M21 3v6h-6"></path>
      </svg>
    </div>
    <h1>Aqui está seu novo link</h1>
    <p>Olá, <strong>${escapeHtml(params.name)}</strong>! Você pediu o reenvio do e-mail de confirmação. Use o botão abaixo — o link anterior deixou de valer.</p>
    <a href="${escapeHtml(params.verifyUrl)}" class="cta">Confirmar e-mail</a>
    <p class="expiry-note">Válido por <strong>24 horas</strong>. Não foi você quem pediu? Ignore este e-mail — sua conta continua segura.</p>
  </div>
  <div class="footer-link">
    O botão não funcionou? Copie e cole este link no navegador:<br>
    <a href="${escapeHtml(params.verifyUrl)}">${escapeHtml(params.verifyUrl.substring(0, 50))}...</a>
  </div>
</div>
<div class="disclaimer">
  ChartFM · Você recebeu este e-mail porque se cadastrou com esta conta<br>
  <a href="https://chartfm.com.br/support">Ajuda</a> · <a href="https://chartfm.com.br/privacy-policy">Privacidade</a> · <a href="https://chartfm.com.br/terms-of-use">Termos</a>
</div>
  `;

  return emailShell(content);
}

export function passwordResetTemplate(params: { name: string; resetUrl: string }): string {
  const content = `
${LOGO_HEADER}
<div class="container">
  <div class="hero"></div>
  <div class="content">
    <div class="icon">
      <svg viewBox="0 0 24 24" fill="none" stroke="${BRAND_COLOR}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="4" y="10" width="16" height="11" rx="3"></rect>
        <path d="M8 10V7a4 4 0 0 1 8 0v3"></path>
        <circle cx="12" cy="15.5" r="1.5" fill="${BRAND_COLOR}" stroke="none"></circle>
      </svg>
    </div>
    <h1>Redefina sua senha</h1>
    <p>Olá, <strong>${escapeHtml(params.name)}</strong>! Recebemos um pedido para redefinir a senha da sua conta. Clique no botão abaixo para criar uma nova senha.</p>
    <a href="${escapeHtml(params.resetUrl)}" class="cta">Criar nova senha</a>
    <p class="expiry-note">O link expira em <strong>1 hora</strong> e só pode ser usado uma vez.<br>Não foi você? Ignore este e-mail — sua senha atual continua valendo.</p>
  </div>
  <div class="footer-link">
    O botão não funcionou? Copie e cole este link no navegador:<br>
    <a href="${escapeHtml(params.resetUrl)}">${escapeHtml(params.resetUrl.substring(0, 50))}...</a>
  </div>
</div>
<div class="disclaimer">
  ChartFM · Você recebeu este e-mail porque existe uma conta com este endereço<br>
  <a href="https://chartfm.com.br/support">Ajuda</a> · <a href="https://chartfm.com.br/privacy-policy">Privacidade</a> · <a href="https://chartfm.com.br/terms-of-use">Termos</a>
</div>
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
