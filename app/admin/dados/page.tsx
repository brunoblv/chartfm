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
  type EscopoContadores,
} from "./lib";
import { AccessDenied, DadosShell } from "./ui";
import { DatesBackfillClient } from "./DatesBackfillClient";
import { ArtistBiosBackfillClient } from "./ArtistBiosBackfillClient";
import { SourceBatchBackfillClient } from "./SourceBatchBackfillClient";

export const dynamic = "force-dynamic";

const cardStyle: CSSProperties = {
  display: "block",
  background: "var(--surface)",
  border: "1px solid var(--divider)",
  borderRadius: 14,
  padding: 14,
  textDecoration: "none",
  minWidth: 0,
};

function StatCard({ label, value, href, alert }: {
  label: string;
  value: number;
  href: string;
  alert?: boolean;
}) {
  const highlight = alert && value > 0;
  return (
    <Link href={href} style={cardStyle}>
      <div
        style={{
          fontSize: 11,
          color: "var(--text-muted)",
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.04em",
          whiteSpace: "nowrap",
          overflow: "hidden",
          textOverflow: "ellipsis",
        }}
      >
        {label}
      </div>
      <div
        style={{
          marginTop: 4,
          fontSize: 26,
          fontWeight: 750,
          letterSpacing: "-0.03em",
          color: highlight ? "#C41E3A" : "var(--text)",
        }}
      >
        {value.toLocaleString("pt-BR")}
      </div>
    </Link>
  );
}

function GroupTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{ margin: "22px 0 10px", fontSize: 17, fontWeight: 750, color: "var(--text)", letterSpacing: "-0.02em" }}>
      {children}
    </h2>
  );
}

const gridStyle: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(170px, 1fr))",
  gap: 10,
  maxWidth: 1240,
};

function SongCards({ base, c }: { base: string; c: EscopoContadores }) {
  return (
    <div style={gridStyle}>
      <StatCard label="Músicas" value={c.total} href={`${base}?filtro=todas`} />
      <StatCard label="Sem álbum" value={c.semAlbum} href={`${base}?filtro=sem-album`} alert />
      <StatCard label="Álbum sem capa" value={c.albumSemCapa} href={`${base}?filtro=album-sem-capa`} alert />
      <StatCard label="Sem MBID" value={c.semMbid} href={`${base}?filtro=sem-mbid`} alert />
      <StatCard label="Sem data do single" value={c.semSingle} href={`${base}?filtro=sem-single`} alert />
      <StatCard label="Sem data do clipe" value={c.semClipe} href={`${base}?filtro=sem-clipe`} alert />
      <StatCard label="Datas não encontradas" value={c.datasNaoEncontradas} href={`${base}?filtro=datas-nao-encontradas`} alert />
      <StatCard label="Data 01/01" value={c.data0101} href={`${base}?filtro=data-01-01`} alert />
    </div>
  );
}

export default async function DadosOverviewPage() {
  const access = await getAdminAccess();
  if (!access) return <AccessDenied />;

  const [ov, semDatas, semBio, songsProblemas, albunsPendencias, artistasPendenciasComBio] = await Promise.all([
    fetchDadosOverview(access.isOwner ? access.userId : null),
    countSongsSemDatas(),
    countArtistsSemBio(),
    countSongsProblemas(),
    countAlbunsPendencias(),
    countArtistsPendenciasComBio(),
  ]);
  const totalPendencias =
    ov.catalogo.semAlbum +
    ov.catalogo.albumSemCapa +
    ov.albuns.semCapa +
    ov.artistas.pendencias;

  return (
    <DadosShell active="geral" subtitle="Visão geral" showMinhasParadas={access.isOwner}>
      <p style={{ margin: "0 0 6px", fontSize: 14, color: "var(--text-muted)", maxWidth: 720, lineHeight: 1.5 }}>
        Regra do catálogo: <strong>toda música tem um álbum, e todo álbum tem uma capa</strong>.
        Clique em um cartão para abrir a lista correspondente.
      </p>

      {ov.minhas && (
        <>
          <GroupTitle>Minhas paradas</GroupTitle>
          <SongCards base="/admin/dados/minhas-paradas" c={ov.minhas} />
        </>
      )}

      <GroupTitle>Catálogo geral · músicas</GroupTitle>
      <SongCards base="/admin/dados/catalogo" c={ov.catalogo} />

      <GroupTitle>Catálogo geral · álbuns e artistas</GroupTitle>
      <div style={gridStyle}>
        <StatCard label="Álbuns" value={ov.albuns.total} href="/admin/dados/albuns-pendencias?filtro=todas" />
        <StatCard label="Álbuns sem capa" value={ov.albuns.semCapa} href="/admin/dados/albuns-pendencias?filtro=sem-capa" alert />
        <StatCard label="Álbuns sem data" value={ov.albuns.semData} href="/admin/dados/albuns-pendencias?filtro=sem-data" alert />
        <StatCard label="Álbuns data 01/01" value={ov.albuns.data0101} href="/admin/dados/albuns-pendencias?filtro=data-01-01" alert />
        <StatCard label="Artistas" value={ov.artistas.total} href="/admin/dados/artistas" />
        <StatCard label="Artistas c/ pendência" value={ov.artistas.pendencias} href="/admin/dados/artistas-pendencias" alert />
      </div>

      <GroupTitle>Ferramentas</GroupTitle>
      <div style={{ maxWidth: 720 }}>
        <DatesBackfillClient initialTotal={semDatas} scope="catalogo" />
        <ArtistBiosBackfillClient initialTotal={semBio} />
        <MissingInfoBackfillClient initialTotal={totalPendencias} />
      </div>

      <GroupTitle>Buscar dados faltantes por API</GroupTitle>
      <div style={{ maxWidth: 720 }}>
        <SourceBatchBackfillClient
          kind="music"
          title="Músicas"
          description="Roda todas as APIs juntas ou uma de cada vez para todas as músicas com pendência (álbum, capa, MBID, datas, gêneros)."
          initialTotal={songsProblemas}
        />
        <SourceBatchBackfillClient
          kind="albums"
          title="Álbuns"
          description="Roda todas as APIs juntas ou uma de cada vez para todos os álbuns com pendência (capa, data, tipo, faixas, link)."
          initialTotal={albunsPendencias}
        />
        <SourceBatchBackfillClient
          kind="artists"
          title="Artistas"
          description="Roda todas as APIs juntas ou uma de cada vez para todos os artistas com pendência (imagem, gêneros, link e bio)."
          initialTotal={artistasPendenciasComBio}
        />
      </div>
    </DadosShell>
  );
}
