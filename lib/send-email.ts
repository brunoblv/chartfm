import nodemailer from "nodemailer";

type SendEmailParams = {
  to: string;
  subject: string;
  html: string;
  text: string;
};

export async function sendEmail(params: SendEmailParams): Promise<boolean> {
  const smtpHost = process.env.SMTP_HOST?.trim();
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const from =
    process.env.EMAIL_FROM?.trim() || "ChartFM <contato@chartfm.com.br>";

  if (smtpHost) {
    const port = Number(process.env.SMTP_PORT?.trim() || 465);
    const user = process.env.SMTP_USER?.trim();
    const pass = process.env.SMTP_PASS?.trim();

    if (!user || !pass) {
      console.error(
        "[email] SMTP_HOST definido mas SMTP_USER/SMTP_PASS ausentes — email NÃO enviado.",
      );
      return false;
    }

    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port,
        // 465 = TLS implícito; outras portas (587/25) usam STARTTLS
        secure: port === 465,
        auth: { user, pass },
      });

      await transporter.sendMail({
        from,
        to: params.to,
        subject: params.subject,
        html: params.html,
        text: params.text,
      });
      return true;
    } catch (e) {
      console.error(
        `[email] Falha no envio via SMTP (host="${smtpHost}", porta=${port}, to="${params.to}")`,
        e,
      );
      return false;
    }
  }

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
        const detail = await res.text().catch(() => "");
        console.error(
          `[email] Resend recusou o envio (status ${res.status}). from="${from}" to="${params.to}" subject="${params.subject}". Resposta: ${detail}`,
        );
        if (res.status === 401 || res.status === 403) {
          console.error(
            "[email] Dica: 401/403 costuma ser RESEND_API_KEY inválida ou domínio de EMAIL_FROM não verificado no Resend.",
          );
        }
        return false;
      }
      return true;
    } catch (e) {
      console.error(`[email] Falha de rede ao chamar o Resend (to="${params.to}")`, e);
      return false;
    }
  }

  if (process.env.NODE_ENV !== "production") {
    console.info("[email] (dev — SMTP/RESEND não configurados)");
    console.info(`  Para: ${params.to}`);
    console.info(`  Assunto: ${params.subject}`);
    console.info(`  Corpo:\n${params.text}`);
    return true;
  }

  console.error(
    `[email] Nenhum provedor de email configurado em produção — email NÃO enviado (to="${params.to}", subject="${params.subject}"). Configure SMTP_HOST/SMTP_USER/SMTP_PASS (ou RESEND_API_KEY) e EMAIL_FROM no .env.`,
  );
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

export function emailVerificationEmail(params: { verifyUrl: string; name: string }) {
  const subject = "Confirme seu email — ChartFM";
  const text = [
    `Olá, ${params.name}!`,
    "",
    "Obrigado por se cadastrar no ChartFM.",
    "Confirme seu email abrindo o link abaixo (válido por 24 horas):",
    "",
    params.verifyUrl,
    "",
    "Se você não criou esta conta, ignore este email.",
  ].join("\n");

  const html = `
    <p>Olá, <strong>${params.name}</strong>!</p>
    <p>Obrigado por se cadastrar no ChartFM. Confirme seu email para ativar sua conta:</p>
    <p><a href="${params.verifyUrl}">Confirmar email</a></p>
    <p style="color:#666;font-size:13px">O link expira em 24 horas. Se você não criou esta conta, ignore este email.</p>
  `;

  return { subject, text, html };
}
