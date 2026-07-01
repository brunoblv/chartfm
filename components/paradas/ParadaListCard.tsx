import Link from "next/link";
import { paradaGradientStyle, paradaPalette } from "@/lib/parada-palette";
import { ParadaLogo } from "./ParadaLogo";

export type ParadaListCardData = {
  id: string;
  name: string;
  logo: string | null;
  genres: string[];
  isPrimary: boolean;
  sortOrder: number;
  cadence?: "weekly" | "daily";
  stats: { weeks: number; numberOnes: number; songs: number };
  lastWeekLabel: string | null;
};

export function ParadaListCard({
  parada,
  href,
}: {
  parada: ParadaListCardData;
  href: string;
}) {
  const palette = paradaPalette(parada.sortOrder);
  const cadenceLabel = parada.cadence === "daily" ? "Diária" : "Semanal";

  return (
    <Link
      href={href}
      style={{
        background: "var(--surface)",
        borderRadius: 18,
        border: "1px solid var(--divider)",
        overflow: "hidden",
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        textDecoration: "none",
        color: "inherit",
      }}
    >
      <div
        style={{
          background: paradaGradientStyle(palette, 0.16),
          padding: "32px 20px 20px",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 14,
          position: "relative",
        }}
      >
        {parada.isPrimary && (
          <div
            style={{
              position: "absolute",
              top: 12,
              right: 12,
              fontSize: 10,
              fontWeight: 700,
              padding: "4px 10px",
              borderRadius: 100,
              background: "rgba(250,36,60,0.18)",
              color: "#FA243C",
              letterSpacing: "0.03em",
            }}
          >
            ★ Principal
          </div>
        )}
        <ParadaLogo
          name={parada.name}
          logo={parada.logo}
          sortOrder={parada.sortOrder}
          size={76}
          rounded={18}
          shadow
        />
        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontSize: 16,
              fontWeight: 800,
              letterSpacing: "-0.025em",
              color: "var(--text)",
            }}
          >
            {parada.name}
          </div>
          <div
            style={{
              fontSize: 12,
              color: "var(--text-muted)",
              marginTop: 3,
              fontWeight: 500,
            }}
          >
            {cadenceLabel}
          </div>
        </div>
      </div>

      {parada.genres.length > 0 && (
        <div
          style={{
            padding: "10px 16px 14px",
            display: "flex",
            flexWrap: "wrap",
            gap: 5,
          }}
        >
          {parada.genres.map((genre) => (
            <span
              key={genre}
              style={{
                fontSize: 11,
                fontWeight: 600,
                padding: "4px 10px",
                borderRadius: 100,
                background: "var(--fill-subtle)",
                color: "var(--text-subtle)",
                letterSpacing: "-0.01em",
              }}
            >
              {genre}
            </span>
          ))}
        </div>
      )}

      <div
        style={{
          padding: "12px 0",
          borderTop: "1px solid var(--divider)",
          borderBottom: "1px solid var(--divider)",
          display: "flex",
          background: "var(--fill-subtle)",
        }}
      >
        {[
          { value: parada.stats.weeks, label: "Semanas" },
          { value: parada.stats.numberOnes, label: "#1s" },
          { value: parada.stats.songs, label: "Músicas" },
        ].map(({ value, label }, i) => (
          <div
            key={label}
            style={{
              flex: 1,
              textAlign: "center",
              padding: "0 8px",
              borderRight: i < 2 ? "1px solid var(--divider)" : undefined,
            }}
          >
            <div
              style={{
                fontSize: 20,
                fontWeight: 800,
                letterSpacing: "-0.03em",
                color: "var(--text)",
                fontVariantNumeric: "tabular-nums",
              }}
            >
              {value}
            </div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 600,
                color: "var(--text-muted)",
                textTransform: "uppercase",
                letterSpacing: "0.03em",
                marginTop: 2,
              }}
            >
              {label}
            </div>
          </div>
        ))}
      </div>

      <div
        style={{
          padding: "13px 16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
        }}
      >
        <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {parada.lastWeekLabel ? `Última: ${parada.lastWeekLabel}` : "Sem publicações"}
        </span>
        <span
          style={{
            fontSize: 13,
            fontWeight: 700,
            color: "var(--accent)",
            letterSpacing: "-0.01em",
          }}
        >
          Ver parada →
        </span>
      </div>
    </Link>
  );
}
