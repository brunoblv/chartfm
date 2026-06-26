type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from = process.env.EMAIL_FROM?.trim() || "ChartFM <noreply@chartfm.com>";

  if (apiKey) {
    try {
      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from,
          to: [params.to],
          subject: params.subject,
          html: params.html,
          text: params.text,
        }),
      });
      if (!res.ok) {
        console.error("[email] Resend error", res.status, await res.text());
        return false;
      }
      return true;
    } catch (e) {
      console.error("[email] Resend fetch failed", e);
      return false;
    }
  }

  if (process.env.NODE_ENV !== "production") {
    console.info("[email] (dev — RESEND_API_KEY não configurada)");
    console.info(`  Para: ${params.to}`);
    console.info(`  Assunto: ${params.subject}`);
    console.info(`  Corpo:\n${params.text}`);
    return true;
  }

  console.error("[email] RESEND_API_KEY ausente em produção");
  return false;
}

export function passwordResetEmail(params: { resetUrl: string; name: string }) {
  const subject = "Redefinir sua senha — ChartFM";
  const text = [
    `Olá, ${params.name}!`,
    "",
    "Recebemos um pedido para redefinir a senha da sua conta ChartFM.",
    "Se foi você, abra o link abaixo (válido por 1 hora):",
    "",
    params.resetUrl,
    "",
    "Se você não pediu isso, ignore este email.",
  ].join("\n");

  const html = `
    <p>Olá, <strong>${params.name}</strong>!</p>
    <p>Recebemos um pedido para redefinir a senha da sua conta ChartFM.</p>
    <p><a href="${params.resetUrl}">Redefinir senha</a></p>
    <p style="color:#666;font-size:13px">O link expira em 1 hora. Se você não pediu isso, ignore este email.</p>
  `;

  return { subject, text, html };
}
