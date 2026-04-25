import { Shell } from "@/components/layout/Shell";
import { Cover } from "@/components/ui/Cover";
import { MovementBadge } from "@/components/ui/MovementBadge";
import { GLOBAL_CHART, USERS_DATA } from "@/lib/data";
import { buildDateRangeFromDate, buildWeekLabelFromDate } from "@/lib/chart-week";

export default function GlobalPage() {
  const now = new Date();
  const weekNow = buildWeekLabelFromDate(now);
  const weekRangeNow = buildDateRangeFromDate(now);
  return (
    <Shell title="Parada Global" subtitle="A parada agregada de toda a plataforma">
      {/* Hero */}
      <div style={{
        background: "linear-gradient(135deg, #1D1D1F 0%, #2C2C2E 100%)",
        borderRadius: 20,
        padding: "48px 48px",
        marginBottom: 40,
        display: "flex",
        gap: 40,
        alignItems: "center",
        color: "white",
      }}>
        <div style={{
          width: 140, height: 140, borderRadius: 20, flexShrink: 0,
          background: "radial-gradient(circle at 30% 30%, #FA243C, #FF5858)",
          boxShadow: "0 16px 40px rgba(250,36,60,0.3)",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="1.8"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>
        </div>
        <div>
          <div style={{ fontSize: 12, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.7, marginBottom: 8 }}>{weekNow}</div>
          <h1 style={{ fontSize: 64, fontWeight: 800, letterSpacing: "-0.04em", lineHeight: 1, marginBottom: 12 }}>Parada Global</h1>
          <p style={{ fontSize: 15, opacity: 0.8, maxWidth: 480, lineHeight: 1.6, marginBottom: 16 }}>
            Cada música ganha <strong>101 − posição</strong> pontos por parada em que aparece. A soma decide o ranking semanal global.
          </p>
          <div style={{ display: "flex", gap: 20, fontSize: 14, opacity: 0.7 }}>
            <span>{USERS_DATA.length} paradas consideradas</span>
            <span>·</span>
            <span>{GLOBAL_CHART.length} músicas</span>
            <span>·</span>
            <span>{weekRangeNow}</span>
          </div>
        </div>
      </div>

      {/* Chart table */}
      <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", overflow: "hidden" }}>
        <div style={{ display: "grid", gridTemplateColumns: "60px 64px 1fr 100px 100px 100px", padding: "10px 20px", background: "rgba(0,0,0,0.02)", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
          {["Pos", "", "Música", "Mudança", "Pontos", "Eleitores"].map((h, i) => (
            <div key={i} style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#86868B", padding: "6px 8px" }}>{h}</div>
          ))}
        </div>
        {GLOBAL_CHART.map((e) => (
          <div
            key={e.position}
            style={{
              display: "grid",
              gridTemplateColumns: "60px 64px 1fr 100px 100px 100px",
              alignItems: "center",
              padding: "8px 20px",
              borderBottom: "1px solid rgba(0,0,0,0.04)",
            }}
          >
            <div style={{
              fontSize: e.position <= 3 ? 28 : 18,
              fontWeight: 700,
              color: "#000000",
              fontVariantNumeric: "tabular-nums",
              textAlign: "right", paddingRight: 12,
              letterSpacing: "-0.04em",
            }}>
              {e.position}
            </div>
            <div style={{ padding: "6px 8px" }}>
              <Cover cover={e.cover} song={e.song} size={48} rounded={8} />
            </div>
            <div style={{ padding: "0 12px", minWidth: 0 }}>
              <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{e.song.title}</div>
              <div style={{ fontSize: 12, color: "#86868B" }}>{e.song.artist}</div>
            </div>
            <div style={{ padding: "0 8px" }}>
              <MovementBadge status={e.status} delta={e.delta} />
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, fontVariantNumeric: "tabular-nums", color: "#FA243C", padding: "0 8px" }}>
              {e.points}
            </div>
            <div style={{ fontSize: 14, color: "#86868B", fontVariantNumeric: "tabular-nums", padding: "0 8px" }}>
              {e.voters} {e.voters === 1 ? "eleitor" : "eleitores"}
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}
