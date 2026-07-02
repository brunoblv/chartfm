import Link from "next/link";
import type { CSSProperties } from "react";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { isPrivilegedRole } from "@/lib/permissions";
import { Shell } from "@/components/layout/Shell";
import { adminNavChipStyle } from "@/components/admin/admin-styles";
import { ArtistCreatePanel } from "../artists/ArtistCreatePanel";
import { CreateAlbumClient } from "../albums/CreateAlbumClient";
import { NoAlbumSection, parseFiltro } from "./sections/NoAlbumSection";
import { NoCoverSection } from "./sections/NoCoverSection";
import { NoMbidSection } from "./sections/NoMbidSection";
import { MissingInfoSection } from "./sections/MissingInfoSection";
import { DataSearchClient } from "./DataSearchClient";

type Tab =
  | "music"
  | "albums"
  | "artists"
  | "no-album"
  | "no-cover"
  | "no-mbid"
  | "missing-music"
  | "missing-artists"
  | "missing-albums";

const TABS: { id: Tab; label: string }[] = [
  { id: "music", label: "Músicas" },
  { id: "albums", label: "Álbuns" },
  { id: "artists", label: "Artistas" },
  { id: "no-album", label: "Músicas sem álbum" },
  { id: "no-cover", label: "Músicas sem capa" },
  { id: "no-mbid", label: "Músicas sem MBID" },
  { id: "missing-music", label: "Faltando · Músicas" },
  { id: "missing-artists", label: "Faltando · Artistas" },
  { id: "missing-albums", label: "Faltando · Álbuns" },
];

const TAB_IDS: Tab[] = TABS.map((t) => t.id);

function tabStyle(active: boolean): CSSProperties {
  return {
    display: "inline-block",
    padding: "8px 16px",
    borderRadius: 999,
    fontSize: 14,
    fontWeight: 700,
    textDecoration: "none",
    border: active ? "1px solid #FA243C" : "1px solid var(--divider-strong)",
    color: active ? "#fff" : "var(--text)",
    background: active ? "#FA243C" : "var(--surface)",
  };
}

export default async function AdminDataEditPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; q?: string; filtro?: string; page?: string }>;
}) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id)
    return (
      <Shell title="Admin" subtitle="Acesso">
        <div>Faça login para acessar.</div>
      </Shell>
    );
  const me = await prisma.user.findUnique({ where: { id: session.user.id }, select: { role: true } });
  if (!isPrivilegedRole(me?.role))
    return (
      <Shell title="Admin" subtitle="Acesso">
        <div>Acesso negado.</div>
      </Shell>
    );

  const params = await searchParams;
  const tab: Tab = TAB_IDS.includes(params.tab as Tab) ? (params.tab as Tab) : "music";
  const query = (params.q ?? "").trim();

  const subtitle = TABS.find((t) => t.id === tab)?.label ?? "Editar músicas";

  return (
    <Shell title="Edição de dados" subtitle={subtitle}>
      <div style={{ width: "100%" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 20 }}>
          {TABS.map((tb) => (
            <Link key={tb.id} href={`/admin/edicao-de-dados?tab=${tb.id}`} style={tabStyle(tab === tb.id)}>
              {tb.label}
            </Link>
          ))}
        </div>

        {tab === "music" && (
          <>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 8, marginBottom: 16 }}>
              <Link href="/admin/music/versions" style={adminNavChipStyle}>Versões (live, remix, acoustic…)</Link>
              <Link href="/admin/music/no-album" style={adminNavChipStyle}>Sem álbum</Link>
              <Link href="/admin/music/no-mbid" style={adminNavChipStyle}>Sem MBID</Link>
              <Link
                href="/admin/music/new"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "7px 14px",
                  borderRadius: 999,
                  background: "#FA243C",
                  color: "#fff",
                  fontWeight: 700,
                  fontSize: 13,
                  textDecoration: "none",
                  whiteSpace: "nowrap",
                }}
              >
                + Adicionar música
              </Link>
            </div>
            <DataSearchClient kind="music" initialQuery={query} />
          </>
        )}

        {tab === "albums" && (
          <>
            <div style={{ marginBottom: 16 }}>
              <Link
                href="/admin/duplicates/albums"
                style={{ fontSize: 13, color: "#FA243C", textDecoration: "none", fontWeight: 600 }}
              >
                → Mergear álbuns duplicados (Deluxe, Bonus Edition, etc.)
              </Link>
            </div>
            <CreateAlbumClient />
            <DataSearchClient kind="albums" initialQuery={query} />
          </>
        )}

        {tab === "artists" && (
          <>
            <ArtistCreatePanel />
            <DataSearchClient kind="artists" initialQuery={query} />
          </>
        )}

        {tab === "no-album" && (
          <NoAlbumSection
            filtro={parseFiltro(params.filtro)}
            page={(() => {
              const p = parseInt(params.page ?? "1", 10);
              return Number.isFinite(p) && p > 0 ? p : 1;
            })()}
          />
        )}

        {tab === "no-cover" && <NoCoverSection />}

        {tab === "no-mbid" && (
          <NoMbidSection
            page={(() => {
              const p = parseInt(params.page ?? "1", 10);
              return Number.isFinite(p) && p > 0 ? p : 1;
            })()}
          />
        )}

        {tab === "missing-music" && <MissingInfoSection entity="music" />}
        {tab === "missing-artists" && <MissingInfoSection entity="artists" />}
        {tab === "missing-albums" && <MissingInfoSection entity="albums" />}
      </div>
    </Shell>
  );
}
