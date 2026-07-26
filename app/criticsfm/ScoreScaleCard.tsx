import { SCORE_BANDS, SCORE_BAND_LABEL_KEYS, formatScoreRange } from "@/lib/album-score";
import { getServerTranslations } from "@/lib/i18n/server-translations";

export async function ScoreScaleCard() {
  const { t } = await getServerTranslations();
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
            {t("criticsfm.scoreScaleTitle")}
          </h2>
          <p
            style={{
              fontSize: 13,
              color: "var(--text-muted)",
              margin: "4px 0 0",
              letterSpacing: "-0.01em",
            }}
          >
            {t("criticsfm.scoreScaleSubtitle")}
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
            <span>{t("criticsfm.scoreScaleRangeHeader")}</span>
            <span>{t("criticsfm.scoreScaleTextHeader")}</span>
          </div>

          {SCORE_BANDS.map((band) => (
            <div
              key={band.id}
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
                {t(SCORE_BAND_LABEL_KEYS[band.id])}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
