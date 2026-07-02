import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Manutenção · ChartFM",
  description: "O ChartFM está temporariamente indisponível para manutenção.",
  robots: { index: false, follow: false },
};

export default function ManutencaoPage() {
  return (
    <main
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "32px 24px",
        textAlign: "center",
        background: "var(--bg)",
        color: "var(--text)",
      }}
    >
      <div
        style={{
          width: 72,
          height: 72,
          borderRadius: 22,
          background: "color-mix(in srgb, var(--accent) 14%, transparent)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 24,
          fontSize: 32,
        }}
        aria-hidden
      >
        🔧
      </div>

      <h1
        style={{
          margin: "0 0 12px",
          fontSize: "clamp(28px, 6vw, 40px)",
          fontWeight: 900,
          letterSpacing: "-0.04em",
        }}
      >
        Voltamos em instantes
      </h1>

      <p
        style={{
          margin: "0 0 28px",
          maxWidth: 420,
          fontSize: 16,
          lineHeight: 1.6,
          color: "var(--text-muted)",
        }}
      >
        Estamos fazendo uma atualização no ChartFM. A plataforma ficará indisponível por alguns minutos.
      </p>

      <div
        style={{
          padding: "14px 18px",
          borderRadius: 14,
          border: "1px solid var(--divider)",
          background: "var(--surface)",
          maxWidth: 420,
          width: "100%",
          fontSize: 13,
          color: "var(--text-subtle)",
          lineHeight: 1.55,
        }}
      >
       Tente recarregar a página em 1–2 minutos.
      </div>
    </main>
  );
}
