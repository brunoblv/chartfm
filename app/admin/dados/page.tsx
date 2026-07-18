import Link from "next/link";
import type { CSSProperties } from "react";
import { MissingInfoBackfillClient } from "../missing-info/MissingInfoBackfillClient";
import {
  countAlbunsPendencias,
  countArtistsPendenciasComBio,
  countArtistsSemBio,
  countSongsProblemas,
  countSongsSemDatas,
  fetchDadosOverview,
  getAdminAccess,
} from "./lib";
import { AccessDenied, DadosShell } from "./ui";
import { DatesBackfillClient } from "./DatesBackfillClient";
import { ArtistBiosBackfillClient } from "./ArtistBiosBackfillClient";
import { BackfillToolCard } from "./SourceBatchBackfillClient";

export const dynamic = "force-dynamic";

const cardStyle: CSSProperties = {
  display: "block",
  background: "var(--surface)",
  border: "1px solid var(--divider)",
  borderRadius: 14,
  padding: 18,
  textDecoration: "none",
  minWidth: 0,
  cursor: "pointer",
};

function OverviewEntityCard({
  label,
  total,
  pendentes,
  href,
}: {
  label: string;
  total: number;
  pendentes: number;
  href: string;
}) {
  const pct = Math.round((pendentes / Math.max(total, 1)) * 100);
  return (
    <Link href={href} style={cardStyle}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span
          style={{
            fontSize: 12.5,
            fontWeight: 750,
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            color: "var(--text-muted)",
          }}
        >
          {label}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 800,
            color: "#fff",
            background: "#FA243C",
            borderRadius: 999,
            padding: "2px 9px",
            whiteSpace: "nowrap",
          }}
        >
          {pendentes.toLocaleString("pt-BR")} pend.
        </span>
      </div>
      <div
        style={{
          marginTop: 8,
          fontSize: 32,
          fontWeight: 750,
          letterSpacing: "-0.03em",
          color: "var(--text)",
        }}
      >
        {total.toLocaleString("pt-BR")}
      </div>
      <div
        style={{
          marginTop: 10,
          height: 6,
          borderRadius: 999,
          background: "var(--fill-inset)",
          overflow: "hidden",
        }}
      >
        <div style={{ height: "100%", width: `${pct}%`, background: "#FA243C", borderRadius: 999 }} />
      </div>
      <div style={{ marginTop: 6, fontSize: 12, color: "var(--text-muted)" }}>
        {pendentes.toLocaleString("pt-BR")} pendente(s)
      </div>
    </Link>
  );
}

function CreateCard({ label, description, href }: { label: string; description: string; href: string }) {
  return (
    <Link href={href} style={{ ...cardStyle, padding: 14 }}>
      <div style={{ fontSize: 14, fontWeight: 750, color: "#FA243C", letterSpacing: "-0.01em" }}>
        + {label}
      </div>
      <div style={{ marginTop: 4, fontSize: 12, color: "var(--text-muted)", lineHeight: 1.45 }}>
        {description}
      </div>
    </Link>
  );
}

function GroupTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2
      style={{
        margin: "0 0 12px",
        fontSize: 16,
        fontWeight: 750,
        color: "var(--text)",
        letterSpacing: "-0.01em",
      }}
    >
      {children}
    </h2>
  );
}

const entityGrid: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
  gap: 12,
  marginBottom: 32,
};

export default async function DadosOverviewPage() {
  const access = await getAdminAccess();
  if (!access) return <AccessDenied />;

  const [ov, semDatas, semBio, songsProblemas, albunsPendencias, artistasPendenciasComBio] =
    await Promise.all([
      fetchDadosOverview(access.isOwner ? access.userId : null),
      countSongsSemDatas(),
      countArtistsSemBio(),
      countSongsProblemas(),
      countAlbunsPendencias(),
      countArtistsPendenciasComBio(),
    ]);

  const musPendentes = songsProblemas;
  const totalPendenciasSpotify =
    ov.catalogo.semAlbum + ov.catalogo.albumSemCapa + ov.albuns.semCapa + ov.artistas.pendencias;

  return (
    <DadosShell active="geral" subtitle="Busque, corrija e faça backfill em um só lugar.">
      <p
        style={{
          margin: "0 0 20px",
          fontSize: 13.5,
          color: "var(--text-muted)",
          maxWidth: 640,
          lineHeight: 1.55,
        }}
      >
        Regra do catálogo:{" "}
        <strong style={{ color: "var(--text)" }}>toda música tem um álbum, e todo álbum tem uma capa.</strong>{" "}
        Clique em um cartão para abrir a lista já filtrada.
      </p>

      <div style={entityGrid}>
        <OverviewEntityCard
          label="Músicas"
          total={ov.catalogo.total}
          pendentes={musPendentes}
          href="/admin/dados/catalogo?filtro=problemas"
        />
        <OverviewEntityCard
          label="Álbuns"
          total={ov.albuns.total}
          pendentes={albunsPendencias}
          href="/admin/dados/albuns-pendencias?filtro=pendencias"
        />
        <OverviewEntityCard
          label="Artistas"
          total={ov.artistas.total}
          pendentes={artistasPendenciasComBio}
          href="/admin/dados/artistas-pendencias?filtro=pendencias"
        />
      </div>

      {ov.minhas && (
        <>
          <GroupTitle>Minhas paradas</GroupTitle>
          <div style={{ ...entityGrid, marginBottom: 32 }}>
            <OverviewEntityCard
              label="Músicas nas minhas paradas"
              total={ov.minhas.total}
              pendentes={
                ov.minhas.semAlbum +
                ov.minhas.albumSemCapa +
                ov.minhas.semMbid +
                ov.minhas.semSingle +
                ov.minhas.semClipe
              }
              href="/admin/dados/minhas-paradas?filtro=problemas"
            />
          </div>
        </>
      )}

      <GroupTitle>Ferramentas de backfill</GroupTitle>
      <div style={entityGrid}>
        <BackfillToolCard
          kind="music"
          title="Backfill de músicas"
          description="Spotify, MusicBrainz, Last.fm e Wikipedia para músicas com pendência."
          initialTotal={songsProblemas}
        />
        <BackfillToolCard
          kind="albums"
          title="Backfill de álbuns"
          description="Capa, data, tipo e faixas para álbuns com pendência."
          initialTotal={albunsPendencias}
        />
        <BackfillToolCard
          kind="artists"
          title="Backfill de artistas"
          description="Imagem, gêneros e bio para artistas com pendência."
          initialTotal={artistasPendenciasComBio}
        />
      </div>

      <GroupTitle>Ferramentas especializadas</GroupTitle>
      <div style={{ maxWidth: 720, marginBottom: 32 }}>
        <DatesBackfillClient initialTotal={semDatas} scope="catalogo" />
        <ArtistBiosBackfillClient initialTotal={semBio} />
        <MissingInfoBackfillClient initialTotal={totalPendenciasSpotify} />
      </div>

      <GroupTitle>Criação manual</GroupTitle>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: 12,
          maxWidth: 760,
        }}
      >
        <CreateCard
          label="Nova música"
          description="Artista e álbum entre os já cadastrados; Spotify ID opcional."
          href="/admin/music/new"
        />
        <CreateCard
          label="Novo artista"
          description="Cadastro manual, com ou sem Spotify ID."
          href="/admin/artists"
        />
        <CreateCard
          label="Novo álbum"
          description="Vinculado a um artista já cadastrado."
          href="/admin/albums"
        />
      </div>
    </DadosShell>
  );
}
