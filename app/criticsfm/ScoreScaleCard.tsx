import { SCORE_BANDS, formatScoreRange } from "@/lib/album-score";

export function ScoreScaleCard() {
  return (
    <section style={{ marginBottom: 48 }}>
      <div
        style={{
          background: "var(--surface)",
          borderRadius: 20,
          border: "1px solid var(--divider)",
          padding: "24px 28px",
          boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
        }}
      >
        <div style={{ marginBottom: 20 }}>
          <h2
            style={{
              fontSize: 20,
              fontWeight: 800,
              letterSpacing: "-0.025em",
              color: "var(--text)",
              margin: 0,
            }}
          >
            Escala de notas
          </h2>
          <p
            style={{
              fontSize: 13,
              color: "var(--text-muted)",
              margin: "4px 0 0",
              letterSpacing: "-0.01em",
            }}
          >
            Como interpretamos a nota média de cada álbum no CriticsFM
          </p>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "120px 1fr",
              gap: 16,
              padding: "10px 0",
              borderBottom: "1px solid var(--divider)",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color: "var(--text-muted)",
            }}
          >
            <span>Faixa</span>
            <span>Texto</span>
          </div>

          {SCORE_BANDS.map((band) => (
            <div
              key={band.label}
              style={{
                display: "grid",
                gridTemplateColumns: "120px 1fr",
                gap: 16,
                alignItems: "center",
                padding: "14px 0",
                borderBottom: "1px solid var(--divider-soft)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div
                  style={{
                    width: 28,
                    height: 28,
                    borderRadius: 8,
                    background: band.color,
                    boxShadow: `0 2px 8px ${band.color}40`,
                    flexShrink: 0,
                  }}
                />
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 800,
                    fontVariantNumeric: "tabular-nums",
                    color: "var(--text)",
                    letterSpacing: "-0.02em",
                  }}
                >
                  {formatScoreRange(band)}
                </div>
              </div>
              <div
                style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: "var(--text)",
                  letterSpacing: "-0.01em",
                }}
              >
                {band.label}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
