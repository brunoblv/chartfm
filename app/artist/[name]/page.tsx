import Link from "next/link";
import { ChevronLeft, Play, Star } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Cover } from "@/components/ui/Cover";
import { MovementBadge } from "@/components/ui/MovementBadge";
import { Avatar } from "@/components/ui/Avatar";
import { ARTISTS, USERS_DATA, COVER_PALETTES } from "@/lib/data";

function artistColor(name: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) | 0;
  const idx = Math.abs(hash) % COVER_PALETTES.length;
  return COVER_PALETTES[idx];
}

export default function ArtistPage({ params }: { params: { name: string } }) {
  const name = decodeURIComponent(params.name);
  const artist = ARTISTS.find((a) => a.name === name) ?? ARTISTS[0];
  const palette = artistColor(artist.name);

  const stats = [
    { label: "Ouvintes únicos", value: artist.listeners, icon: "🎧", color: "#FA243C" },
    { label: "Músicas rankeadas", value: artist.songs.length, icon: "🎵", color: "#8338EC" },
    { label: "Número 1s", value: artist.number1s, icon: "👑", color: "#FFD700" },
    { label: "Pontos totais", value: artist.totalPoints, icon: "⭐", color: "#FB5607" },
  ];

  const bigFans = USERS_DATA.slice(0, 4).map((u, i) => ({
    user: u,
    points: [234, 187, 154, 98][i],
  }));

  return (
    <Shell title="" noPadding>
      {/* Hero */}
      <div style={{
        background: `linear-gradient(180deg, ${palette[0]} 0%, ${palette[1]} 50%, #FBFBFD 100%)`,
        padding: "48px 40px 40px 40px",
        position: "relative",
      }}>
        <Link href="/discover" style={{ display: "inline-flex", alignItems: "center", gap: 6, color: "rgba(255,255,255,0.8)", fontSize: 14, fontWeight: 500, textDecoration: "none", marginBottom: 32 }}>
          <ChevronLeft size={16} />
          Voltar
        </Link>

        <div style={{ display: "flex", gap: 40, alignItems: "flex-end", flexWrap: "wrap" }}>
          {/* Avatar */}
          <div style={{
            width: 200, height: 200, borderRadius: "50%",
            background: `radial-gradient(circle at 30% 30%, ${palette[1]}, ${palette[0]})`,
            boxShadow: "0 16px 40px rgba(0,0,0,0.3)",
            flexShrink: 0,
          }} />

          <div style={{ color: "white", flex: 1, minWidth: 280 }}>
            <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.8, marginBottom: 8 }}>
              Artista
            </div>
            <h1 style={{ fontSize: 72, fontWeight: 800, letterSpacing: "-0.045em", lineHeight: 1, marginBottom: 16 }}>
              {artist.name}
            </h1>
            <div style={{ display: "flex", gap: 20, flexWrap: "wrap", fontSize: 14, opacity: 0.9, marginBottom: 24 }}>
              <span><strong>{artist.listeners}</strong> ouvintes</span>
              <span><strong>{artist.songs.length}</strong> músicas rankeadas</span>
              <span><strong>{artist.number1s}</strong> #1s</span>
              <span><strong>{artist.totalPoints}</strong> pontos</span>
            </div>
            <div style={{ display: "flex", gap: 10 }}>
              <button style={{
                display: "flex", alignItems: "center", gap: 8,
                background: "white", color: palette[0], border: "none",
                padding: "12px 24px", borderRadius: 100, fontSize: 14, fontWeight: 700,
              }}>
                <Play size={16} fill={palette[0]} />
                Ouvir
              </button>
              <button style={{
                background: "rgba(255,255,255,0.15)", color: "white", border: "1px solid rgba(255,255,255,0.3)",
                padding: "12px 24px", borderRadius: 100, fontSize: 14, fontWeight: 600,
                backdropFilter: "blur(10px)",
              }}>
                Seguir artista
              </button>
            </div>
          </div>
        </div>
      </div>

      <div style={{ padding: "36px 40px 80px 40px" }}>
        {/* Stats cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, marginBottom: 40 }}>
          {stats.map((s) => (
            <div key={s.label} style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", padding: 20 }}>
              <div style={{ width: 44, height: 44, borderRadius: "50%", background: s.color + "18", display: "grid", placeItems: "center", marginBottom: 12, fontSize: 22 }}>
                {s.icon}
              </div>
              <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#86868B", marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontSize: 36, fontWeight: 700, letterSpacing: "-0.03em", fontVariantNumeric: "tabular-nums" }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* Popular songs */}
        <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", overflow: "hidden", marginBottom: 40 }}>
          <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(0,0,0,0.06)" }}>
            <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.025em" }}>Músicas populares</h2>
          </div>
          <div style={{ padding: "0 8px" }}>
            {/* Header */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "40px 56px minmax(0,1fr) 100px 100px 100px 120px",
              padding: "8px 16px",
              gap: 0,
            }}>
              {["#", "", "Música", "Pontos", "Paradas", "Melhor pos.", "Movimento"].map((h, i) => (
                <div key={i} style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#86868B", padding: "8px 6px" }}>{h}</div>
              ))}
            </div>
            {artist.songs.slice(0, 10).map((s, i) => (
              <div key={s.title} style={{
                display: "grid",
                gridTemplateColumns: "40px 56px minmax(0,1fr) 100px 100px 100px 120px",
                alignItems: "center",
                padding: "4px 16px",
                borderRadius: 8,
                gap: 0,
              }}>
                <div style={{ fontSize: 14, fontWeight: 700, color: "#000000", fontVariantNumeric: "tabular-nums", padding: "0 6px" }}>{i + 1}</div>
                <div style={{ padding: "6px 6px" }}>
                  <Cover cover={s.cover} song={{ title: s.title, artist: artist.name }} size={44} rounded={8} />
                </div>
                <div style={{ padding: "0 12px", minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{s.title}</div>
                  <div style={{ fontSize: 12, color: "#86868B" }}>{s.album}</div>
                </div>
                <div style={{ fontSize: 14, fontWeight: 600, fontVariantNumeric: "tabular-nums", padding: "0 6px" }}>{s.points}</div>
                <div style={{ fontSize: 14, color: "#86868B", fontVariantNumeric: "tabular-nums", padding: "0 6px" }}>{s.appearances}</div>
                <div style={{ fontSize: 14, fontVariantNumeric: "tabular-nums", padding: "0 6px", display: "flex", alignItems: "center", gap: 4 }}>
                  {s.bestPos === 1 && <Star size={12} color="#FA243C" fill="#FA243C" />}
                  #{s.bestPos}
                </div>
                <div style={{ padding: "0 6px" }}>
                  <MovementBadge status={i % 2 === 0 ? "up" : "down"} delta={i % 2 === 0 ? i + 1 : -(i + 1)} compact />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Top fans */}
        <div>
          <h2 style={{ fontSize: 20, fontWeight: 700, letterSpacing: "-0.025em", marginBottom: 16 }}>Maiores fãs</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
            {bigFans.map(({ user, points }) => (
              <Link key={user.id} href={`/profile/${user.handle}`} style={{ textDecoration: "none" }}>
                <div style={{ background: "white", borderRadius: 18, border: "1px solid rgba(0,0,0,0.06)", padding: 20, textAlign: "center" }}>
                  <Avatar user={user} size={56} />
                  <div style={{ marginTop: 12, fontSize: 14, fontWeight: 600, color: "#1D1D1F" }}>{user.name}</div>
                  <div style={{ fontSize: 12, color: "#86868B", marginBottom: 8 }}>@{user.handle}</div>
                  <div style={{ fontSize: 11, fontWeight: 600, letterSpacing: "0.04em", textTransform: "uppercase", color: "#86868B", marginBottom: 4 }}>Pontos no artista</div>
                  <div style={{ fontSize: 24, fontWeight: 700, color: palette[0], fontVariantNumeric: "tabular-nums" }}>{points}</div>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </Shell>
  );
}
