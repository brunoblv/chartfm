export type TelegramCardInput = {
  /** Etiqueta curta acima do texto, ex.: "Copa ChartFM", "Parada Global". */
  eyebrow: string;
  /** Texto principal do evento (a mesma mensagem enviada aos usuários). */
  text: string;
  /** Cor de destaque (hex). */
  accent: string;
};

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** HTML de um card quadrado 1080x1080 com a identidade visual do ChartFM. */
export function buildCardHtml({ eyebrow, text, accent }: TelegramCardInput): string {
  const safeEyebrow = escapeHtml(eyebrow);
  const safeText = escapeHtml(text);
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    html, body { width: 1080px; height: 1080px; background: #FCFCFD; }
    .canvas {
      position: relative;
      width: 1080px;
      height: 1080px;
      background: #FCFCFD;
      overflow: hidden;
      font-family: -apple-system, BlinkMacSystemFont, 'SF Pro Display', 'Segoe UI', system-ui, sans-serif;
    }
    .pill {
      position: absolute;
      left: -40px;
      top: 150px;
      width: 92px;
      height: 780px;
      border-radius: 9999px;
      background: linear-gradient(180deg, ${accent} 0%, #FF7098 55%, #FFBCCA 100%);
    }
    .logo {
      position: absolute;
      top: 72px;
      left: 96px;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .logo-icon {
      width: 48px;
      height: 48px;
      border-radius: 12px;
      background: ${accent};
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
    }
    .logo-text { font-size: 30px; font-weight: 800; letter-spacing: -0.03em; color: #1D1D1F; }
    .content {
      position: absolute;
      left: 96px;
      right: 96px;
      top: 300px;
      display: flex;
      flex-direction: column;
      gap: 28px;
    }
    .eyebrow {
      display: inline-flex;
      align-self: flex-start;
      align-items: center;
      gap: 10px;
      padding: 12px 22px;
      border-radius: 9999px;
      background: ${accent}1A;
      color: ${accent};
      font-size: 26px;
      font-weight: 700;
      letter-spacing: 0.01em;
    }
    .eyebrow .dot { width: 12px; height: 12px; border-radius: 50%; background: ${accent}; }
    .headline {
      font-size: 62px;
      line-height: 1.14;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #1D1D1F;
      max-width: 860px;
    }
    .footer {
      position: absolute;
      left: 96px;
      bottom: 72px;
      font-size: 26px;
      font-weight: 700;
      color: #86868B;
    }
    .bars {
      position: absolute;
      right: 40px;
      bottom: 0;
      display: flex;
      align-items: flex-end;
      gap: 16px;
    }
    .bar { width: 60px; border-radius: 100px 100px 0 0; }
    .dots {
      position: absolute;
      top: 72px;
      right: 72px;
      display: grid;
      grid-template-columns: repeat(6, 13px);
      gap: 9px;
    }
    .dot-bg { width: 5px; height: 5px; border-radius: 50%; background: ${accent}; opacity: 0.18; }
  </style>
</head>
<body>
  <div class="canvas">
    <svg style="position:absolute;top:0;right:0;" width="560" height="440" viewBox="0 0 560 460">
      <defs>
        <linearGradient id="blob1" x1="100%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stop-color="${accent}" stop-opacity="0.14"/>
          <stop offset="100%" stop-color="#FFB8C2" stop-opacity="0.02"/>
        </linearGradient>
      </defs>
      <path d="M560,0 L560,270 Q510,460 390,420 Q200,368 222,175 Q248,-38 560,0Z" fill="url(#blob1)"/>
    </svg>
    <svg style="position:absolute;bottom:0;left:0;" width="1080" height="220" viewBox="0 0 1080 230" preserveAspectRatio="none">
      <defs>
        <linearGradient id="wave1" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#FFD0D8" stop-opacity="0.18"/>
          <stop offset="100%" stop-color="#FFB8C8" stop-opacity="0.45"/>
        </linearGradient>
      </defs>
      <path d="M0,150 Q270,75 540,118 Q810,158 1080,90 L1080,230 L0,230Z" fill="url(#wave1)"/>
    </svg>

    <div class="pill"></div>

    <div class="logo">
      <div class="logo-icon">
        <svg width="26" height="26" viewBox="0 0 24 24" fill="white">
          <rect x="3" y="13" width="4" height="8" rx="1.5"/>
          <rect x="10" y="8" width="4" height="13" rx="1.5"/>
          <rect x="17" y="4" width="4" height="17" rx="1.5"/>
        </svg>
      </div>
      <span class="logo-text">ChartFM</span>
    </div>

    <div class="content">
      <span class="eyebrow"><span class="dot"></span>${safeEyebrow}</span>
      <div class="headline">${safeText}</div>
    </div>

    <div class="footer">chartfm.com.br</div>

    <div class="bars">
      <div class="bar" style="height:240px;background:linear-gradient(180deg,#FFB8C8,#FFD8E2);opacity:0.45;"></div>
      <div class="bar" style="height:360px;background:linear-gradient(180deg,#FF88A8,#FFB8C8);opacity:0.62;"></div>
      <div class="bar" style="height:520px;background:linear-gradient(180deg,${accent},#FF88A8);opacity:0.80;"></div>
    </div>

    <div class="dots" id="dots"></div>
  </div>
  <script>
    var el = document.getElementById('dots');
    for (var i = 0; i < 54; i++) { var d = document.createElement('div'); d.className = 'dot-bg'; el.appendChild(d); }
  </script>
</body>
</html>`;
}

/**
 * Renderiza o card do evento como PNG usando o Chromium do Playwright.
 * Best-effort: retorna null se o Playwright/Chromium não estiver disponível.
 */
export async function renderEventCard(input: TelegramCardInput): Promise<Buffer | null> {
  let browser: import("playwright").Browser | null = null;
  try {
    const { chromium } = await import("playwright");
    browser = await chromium.launch({ headless: true, args: ["--no-sandbox"] });
    const page = await browser.newPage({ viewport: { width: 1080, height: 1080 }, deviceScaleFactor: 1 });
    await page.setContent(buildCardHtml(input), { waitUntil: "networkidle" });
    const png = await page.screenshot({ type: "png" });
    return Buffer.from(png);
  } catch (err) {
    console.error("[telegram-card] falha ao renderizar card", err);
    return null;
  } finally {
    await browser?.close().catch(() => {});
  }
}
