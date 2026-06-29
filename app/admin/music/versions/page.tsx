import Link from "next/link";
import type { CSSProperties } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";
import { Shell } from "@/components/layout/Shell";
import { AdminSongLinks, AdminSongNameLink } from "@/components/admin/AdminEntityLinks";
import { VERSION_TAG_CLEANERS, type VersionTagType } from "@/lib/clean-version-tag";
import { SpotifyFixButton } from "./SpotifyFixButton";
import { CleanVersionTagButton } from "./CleanVersionTagButton";

const PAGE_SIZE = 100;

type FilterKey =
  | "todos"
  | "live"
  | "acoustic"
  | "remix"
  | "instrumental"
  | "demo"
  | "remaster"
  | "extended"
  | "outros";

const FILTERS: { key: FilterKey; label: string; terms: string[]; badge: string; badgeColor: string }[] = [
  {
    key: "todos",
    label: "Todos",
    terms: [
      "live", "ao vivo", "in concert",
      "acoustic", "acústico", "unplugged",
      "remix", "remixed",
      "instrumental",
      "demo",
      "remaster", "remastered",
      "extended", "radio edit", "single edit",
      "cover", "reprise", "sped up", "slowed",
    ],
    badge: "",
    badgeColor: "",
  },
  {
    key: "live",
    label: "Live / Ao Vivo",
    terms: ["live", "ao vivo", "in concert"],
    badge: "Live",
    badgeColor: "#E8450A",
  },
  {
    key: "acoustic",
    label: "Acoustic",
    terms: ["acoustic", "acústico", "unplugged"],
    badge: "Acoustic",
    badgeColor: "#1B873F",
  },
  {
    key: "remix",
    label: "Remix",
    terms: ["remix", "remixed"],
    badge: "Remix",
    badgeColor: "#7C3AED",
  },
  {
    key: "instrumental",
    label: "Instrumental",
    terms: ["instrumental"],
    badge: "Instrumental",
    badgeColor: "#0369A1",
  },
  {
    key: "demo",
    label: "Demo",
    terms: ["demo"],
    badge: "Demo",
    badgeColor: "#92400E",
  },
  {
    key: "remaster",
    label: "Remaster",
    terms: ["remaster", "remastered"],
    badge: "Remaster",
    badgeColor: "#64748B",
  },
  {
    key: "extended",
    label: "Extended / Edit",
    terms: ["extended", "radio edit", "single edit"],
    badge: "Extended",
    badgeColor: "#0F766E",
  },
  {
    key: "outros",
    label: "Outros",
    terms: ["cover", "reprise", "sped up", "slowed"],
    badge: "Outro",
    badgeColor: "#6B6B70",
  },
];

function parseFilter(raw: string | undefined): FilterKey {
  const found = FILTERS.find((f) => f.key === raw);
  return found ? found.key : "todos";
}

function detectBadge(title: string): { label: string; color: string } {
  const t = title.toLowerCase();
  if (/\b(ao vivo|in concert)\b/.test(t) || /\blive\b/.test(t))
    return { label: "Live", color: "#E8450A" };
  if (/\b(acústico|unplugged)\b/.test(t) || /\bacoustic\b/.test(t))
    return { label: "Acoustic", color: "#1B873F" };
  if (/\bremix(?:ed)?\b/.test(t))
    return { label: "Remix", color: "#7C3AED" };
  if (/\binstrumental\b/.test(t))
    return { label: "Instrumental", color: "#0369A1" };
  if (/\bdemo\b/.test(t))
    return { label: "Demo", color: "#92400E" };
  if (/\bremaster(?:ed)?\b/.test(t))
    return { label: "Remaster", color: "#64748B" };
  if (/\b(extended|radio edit|single edit)\b/.test(t))
    return { label: "Extended", color: "#0F766E" };
  if (/\bcover\b/.test(t))
    return { label: "Cover", color: "#6B6B70" };
  if (/\breprise\b/.test(t))
    return { label: "Reprise", color: "#6B6B70" };
  if (/\b(sped up|slowed)\b/.test(t))
    return { label: "Sped Up/Slowed", color: "#6B6B70" };
  return { label: "Versão", color: "#6B6B70" };
}

export default async function AdminMusicVersionsPage({
  searchParams,
}: {
  searchParams: Promise<{ filtro?: string; page?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return <Shell title="Admin" subtitle="Acesso"><div>Faça login para acessar.</div></Shell>;
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!isPrivilegedRole(me?.role))
    return <Shell title="Admin" subtitle="Acesso"><div>Acesso negado.</div></Shell>;

  const sp = await searchParams;
  const filtro = parseFilter(sp.filtro);
  const pageRaw = parseInt(sp.page ?? "1", 10);
  const page = Number.isFinite(pageRaw) && pageRaw > 0 ? pageRaw : 1;
  const skip = (page - 1) * PAGE_SIZE;

  const activeFilter = FILTERS.find((f) => f.key === filtro)!;
  const where = {
    OR: activeFilter.terms.map((term) => ({
      title: { contains: term, mode: "insensitive" as const },
    })),
  };

  const [total, songs] = await Promise.all([
    prisma.song.count({ where }),
    prisma.song.findMany({
      where,
      select: {
        id: true,
        title: true,
        artist: true,
        album: true,
        spotifyId: true,
        artistRef: { select: { id: true, name: true } },
        _count: { select: { entries: true } },
      },
      orderBy: [{ artist: "asc" }, { title: "asc" }],
      skip,
      take: PAGE_SIZE,
    }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const qBase = (p: number, f: FilterKey) => `/admin/music/versions?filtro=${f}&page=${p}`;

  return (
    <Shell title="Admin" subtitle="Músicas com versões">
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            marginBottom: 14,
          }}
        >
          <Link href="/admin/music" style={backStyle}>← Voltar a editar músicas</Link>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8, justifyContent: "flex-end" }}>
            {(Object.keys(VERSION_TAG_CLEANERS) as VersionTagType[]).map((key) => {
              const cfg = VERSION_TAG_CLEANERS[key];
              return (
                <CleanVersionTagButton
                  key={key}
                  type={key}
                  label={cfg.label}
                  description={cfg.description}
                />
              );
            })}
          </div>
        </div>

        <p style={{ margin: "0 0 14px", fontSize: 14, color: "#6B6B70", lineHeight: 1.45 }}>
          Músicas cujo título contém palavras-chave de versão — live, remix, acoustic, instrumental, demo, etc.
          Total: <strong>{total.toLocaleString("pt-BR")}</strong> músicas
          {filtro !== "todos" ? ` no filtro "${activeFilter.label}"` : ""}.
        </p>

        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
          {FILTERS.map((f) => (
            <Link
              key={f.key}
              href={qBase(1, f.key)}
              style={{
                ...chipStyle,
                background: filtro === f.key ? "rgba(250,36,60,0.10)" : "white",
                color: filtro === f.key ? "#FA243C" : "#1D1D1F",
                borderColor: filtro === f.key ? "rgba(250,36,60,0.35)" : "rgba(0,0,0,0.12)",
                fontWeight: filtro === f.key ? 700 : 600,
              }}
            >
              {f.label}
            </Link>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: 10,
            flexWrap: "wrap",
            gap: 8,
          }}
        >
          <span style={{ fontSize: 13, color: "#86868B" }}>
            {songs.length} de {total.toLocaleString("pt-BR")} — página {page} / {totalPages}
          </span>
        </div>

        <div
          style={{
            background: "white",
            borderRadius: 14,
            border: "1px solid rgba(0,0,0,0.08)",
            overflow: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "rgba(0,0,0,0.03)" }}>
                <th style={thStyle}>Música</th>
                <th style={thStyle}>Tipo</th>
                <th style={thStyle}>Artista</th>
                <th style={thStyle}>Álbum</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Entradas</th>
                <th style={{ ...thStyle, textAlign: "center" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {songs.map((s) => {
                const artist = s.artistRef?.name ?? s.artist;
                const badge = detectBadge(s.title);
                return (
                  <tr key={s.id}>
                    <td style={tdStyle}>
                      <AdminSongNameLink
                        song={{
                          id: s.id,
                          title: s.title,
                          artist,
                          artistId: s.artistRef?.id,
                          spotifyId: s.spotifyId,
                        }}
                      />
                    </td>
                    <td style={tdStyle}>
                      <span
                        style={{
                          display: "inline-block",
                          fontSize: 11,
                          fontWeight: 700,
                          borderRadius: 6,
                          padding: "3px 7px",
                          background: badge.color + "22",
                          color: badge.color,
                          whiteSpace: "nowrap",
                        }}
                      >
                        {badge.label}
                      </span>
                    </td>
                    <td style={tdStyle}>{artist}</td>
                    <td style={{ ...tdStyle, color: s.album?.trim() ? "#1D1D1F" : "#C0C0C6" }}>
                      {s.album?.trim() || "—"}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right", fontWeight: 600 }}>
                      {s._count.entries}
                    </td>
                    <td style={{ ...tdStyle, textAlign: "center" }}>
                      <div style={{ display: "flex", gap: 12, justifyContent: "center", alignItems: "center", flexWrap: "wrap" }}>
                        <AdminSongLinks
                          song={{
                            id: s.id,
                            title: s.title,
                            artist,
                            artistId: s.artistRef?.id,
                            spotifyId: s.spotifyId,
                          }}
                        />
                        <SpotifyFixButton songId={s.id} songTitle={s.title} />
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {songs.length === 0 && (
            <div style={{ padding: 16, color: "#86868B", fontSize: 14 }}>
              Nenhuma música encontrada neste filtro.
            </div>
          )}
        </div>

        {totalPages > 1 && (
          <div
            style={{
              display: "flex",
              gap: 12,
              marginTop: 16,
              justifyContent: "center",
              flexWrap: "wrap",
            }}
          >
            {page > 1 && (
              <Link href={qBase(page - 1, filtro)} style={pageLinkStyle}>
                ← Anterior
              </Link>
            )}
            {page < totalPages && (
              <Link href={qBase(page + 1, filtro)} style={pageLinkStyle}>
                Próxima →
              </Link>
            )}
          </div>
        )}
      </div>
    </Shell>
  );
}

const backStyle: CSSProperties = {
  color: "#86868B",
  textDecoration: "none",
  fontSize: 14,
  fontWeight: 600,
};
const chipStyle: CSSProperties = {
  display: "inline-block",
  padding: "7px 12px",
  borderRadius: 999,
  border: "1px solid rgba(0,0,0,0.12)",
  fontSize: 13,
  textDecoration: "none",
};
const thStyle: CSSProperties = {
  textAlign: "left",
  padding: "10px 12px",
  fontSize: 12,
  color: "#6B6B70",
  fontWeight: 700,
};
const tdStyle: CSSProperties = {
  padding: "10px 12px",
  borderTop: "1px solid rgba(0,0,0,0.06)",
  fontSize: 14,
  color: "#1D1D1F",
};
const pageLinkStyle: CSSProperties = {
  padding: "10px 16px",
  borderRadius: 10,
  border: "1px solid rgba(0,0,0,0.12)",
  background: "white",
  color: "#1D1D1F",
  fontWeight: 600,
  textDecoration: "none",
  fontSize: 14,
};
