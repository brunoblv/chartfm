import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["pg", "@napi-rs/canvas"],
  allowedDevOrigins: ["127.0.0.1", "localhost"],
  // A VPS tem só 1.9 GB de RAM: a checagem de tipos DENTRO do `next build` dá um
  // pico que o OOM killer corta (o build compila e morre em "Running TypeScript
  // ...Killed"). Rodamos o type-check separado (npm run typecheck) antes de subir
  // — o build da VPS não precisa repetir isso.
  typescript: { ignoreBuildErrors: true },
  experimental: {
    serverActions: {
      bodySizeLimit: "5mb",
    },
  },
  images: {
    // Next 16 exige allowlist explícita pra otimizar imagem local com query string.
    // Uploads (avatar, capa, logo de parada, clipe) usam `?v=timestamp` pra cache-busting,
    // e sem isso o next/image lança exceção no SSR — derrubava a página inteira (500).
    // OBS: `search` no matcher do Next é comparação EXATA, não wildcard — como o
    // timestamp muda a cada upload, o campo precisa ficar de fora (undefined) pra
    // aceitar qualquer query string, em vez de "*" (que só bateria com `?*` literal).
    localPatterns: [{ pathname: "/api/uploads/**" }],
    remotePatterns: [
      { hostname: "lh3.googleusercontent.com" },
      { hostname: "i.scdn.co" },
      { hostname: "coverartarchive.org" },
    ],
  },
  async redirects() {
    return [
      // Legacy Portuguese page routes
      { source: "/novidades", destination: "/whats-new", permanent: true },
      { source: "/parada/setup", destination: "/chart/setup", permanent: true },
      { source: "/sobre", destination: "/about", permanent: true },
      { source: "/politica-de-privacidade", destination: "/privacy-policy", permanent: true },
      { source: "/exclusao-de-dados", destination: "/data-deletion", permanent: true },
      { source: "/termos-de-uso", destination: "/terms-of-use", permanent: true },
      { source: "/contato", destination: "/contact", permanent: true },
      // Legacy upload path (logos stored in DB with old URL)
      { source: "/api/uploads/parada-logos/:filename*", destination: "/api/uploads/chart-logos/:filename*", permanent: true },
    ];
  },
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "SAMEORIGIN" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          {
            key: "Strict-Transport-Security",
            value: "max-age=63072000; includeSubDomains",
          },
          {
            key: "Permissions-Policy",
            value: "camera=(), microphone=(), geolocation=()",
          },
          // Diretivas seguras impostas: reforçam contra clickjacking (frame-ancestors),
          // injeção de <base> (base-uri) e plugins/objetos (object-src). Nenhuma
          // afeta scripts/estilos, então não quebram o AdSense nem o Analytics.
          {
            key: "Content-Security-Policy",
            value: "frame-ancestors 'self'; base-uri 'self'; object-src 'none'",
          },
          // Política completa em modo Report-Only: o navegador reporta violações
          // no console sem bloquear nada. Serve para observar o que uma CSP estrita
          // quebraria (scripts inline, AdSense, GA) antes de migrar para imposição.
          {
            key: "Content-Security-Policy-Report-Only",
            value: CSP_REPORT_ONLY,
          },
        ],
      },
    ];
  },
};

// Alvo de CSP estrita para futura imposição. Cobre os terceiros atuais
// (Google Analytics + AdSense). `'unsafe-inline'` em script-src ainda é
// necessário por causa dos scripts inline (tema, JSON-LD, config do GA);
// migrar para nonces removeria essa necessidade.
const CSP_REPORT_ONLY = [
  "default-src 'self'",
  "base-uri 'self'",
  "object-src 'none'",
  "frame-ancestors 'self'",
  "img-src 'self' data: blob: https:",
  "font-src 'self' data:",
  "style-src 'self' 'unsafe-inline'",
  "script-src 'self' 'unsafe-inline' https://pagead2.googlesyndication.com https://*.googlesyndication.com https://www.googletagmanager.com https://www.google-analytics.com https://adservice.google.com https://*.googleadservices.com https://www.highperformanceformat.com https://*.effectivecpmnetwork.com",
  "connect-src 'self' https://www.google-analytics.com https://region1.google-analytics.com https://pagead2.googlesyndication.com https://*.googlesyndication.com https://*.google.com https://www.highperformanceformat.com https://*.effectivecpmnetwork.com",
  "frame-src https://googleads.g.doubleclick.net https://tpc.googlesyndication.com https://*.googlesyndication.com https://www.google.com https://www.highperformanceformat.com https://*.effectivecpmnetwork.com",
].join("; ");

export default nextConfig;
