import type { Metadata } from "next";
import { prisma } from "@/lib/prisma";
import { Shell } from "@/components/layout/Shell";
import { getRankingWeekReference } from "@/lib/chart-week";
import { GlobalTabs } from "@/components/global/GlobalTabs";
import { computeGlobalSnapshotData, getOrCreateRankingWeekSnapshot } from "@/lib/global-snapshot";
import { BookOpen, BarChart2, Users, TrendingUp, Music } from "lucide-react";
import { GlobalHero } from "@/components/global/GlobalHero";

export const metadata: Metadata = {
  title: "Global 100 | As músicas mais populares da comunidade ChartFM",
  description:
    "Acompanhe o Global 100 do ChartFM, a parada musical coletiva criada a partir das charts pessoais e avaliações da comunidade. Rankings semanais de músicas e artistas atualizados toda segunda-feira.",
  alternates: { canonical: "/global" },
};

type ArtistImageKey = { name: string; spotifyId: string | null };
type GlobalSongLike = Awaited<ReturnType<typeof computeGlobalSnapshotData>>["weeklySongs"][number];

function isMissingImageUrl(url: string | null | undefined): boolean {
  return url === undefined || url === null || url === "";
}

async function resolveArtistImages(artists: ArtistImageKey[]): Promise<Map<string, string | null>> {
  const imageMap = new Map<string, string | null>();

  const spotifyIds = [...new Set(artists.map((a) => a.spotifyId).filter((x): x is string => Boolean(x)))];
  if (spotifyIds.length) {
    const byId = await prisma.artist.findMany({
      where: { spotifyId: { in: spotifyIds } },
      select: { spotifyId: true, imageUrl: true },
    });
    const idToUrl = new Map(byId.map((r) => [r.spotifyId, r.imageUrl]));
    for (const a of artists) {
      if (!a.spotifyId) continue;
      const u = idToUrl.get(a.spotifyId);
      if (!isMissingImageUrl(u ?? undefined)) imageMap.set(a.name, u!);
    }
  }

  const names = [...new Set(artists.map((a) => a.name))];
  const byName = names.length
    ? await prisma.artist.findMany({
        where: { name: { in: names } },
        select: { name: true, imageUrl: true },
      })
    : [];
  const nameToUrl = new Map(byName.map((r) => [r.name, r.imageUrl]));

  for (const a of artists) {
    if (!isMissingImageUrl(imageMap.get(a.name))) continue;
    const fromName = nameToUrl.get(a.name);
    if (!isMissingImageUrl(fromName ?? undefined)) imageMap.set(a.name, fromName!);
  }

  for (const a of artists) {
    if (!imageMap.has(a.name)) imageMap.set(a.name, null);
  }

  return imageMap;
}

async function hydrateSongCovers(entries: GlobalSongLike[]): Promise<GlobalSongLike[]> {
  if (!entries.length) return entries;
  const ids = [...new Set(entries.map((e) => e.song.id).filter((id): id is string => Boolean(id)))];
  const rows = await prisma.song.findMany({
    where: { id: { in: ids } },
    select: {
      id: true,
      spotifyId: true,
      albumRef: { select: { coverUrl: true } },
    },
  });
  const byId = new Map(rows.map((r) => [r.id, r]));
  const bySpotifyId = new Map(rows.filter((r) => r.spotifyId).map((r) => [r.spotifyId as string, r]));

  return entries.map((entry) => {
    const refById = entry.song.id ? byId.get(entry.song.id) : undefined;
    const refBySpotifyId = entry.song.spotifyId ? bySpotifyId.get(entry.song.spotifyId) : undefined;
    const ref = refById ?? refBySpotifyId;
    const imageUrl = ref?.albumRef?.coverUrl?.trim() || null;
    return {
      ...entry,
      song: { ...entry.song, imageUrl },
      cover: { ...entry.cover, imageUrl },
    };
  });
}

type GlobalPageProps = {
  searchParams?: Promise<{ week?: string }> | { week?: string };
};

export default async function GlobalPage({ searchParams }: GlobalPageProps) {
  const params = searchParams
    ? ("then" in searchParams ? await searchParams : searchParams)
    : {};
  const requestedWeek = Number(params.week ?? "");
  const rankingWeek = getRankingWeekReference(new Date());
  const availableWeeks = await prisma.chart.findMany({
    where: { weekIndex: { lte: rankingWeek.weekIndex } },
    select: { weekIndex: true, weekLabel: true, dateRange: true },
    distinct: ["weekIndex"],
    orderBy: { weekIndex: "desc" },
  });
  const availableWeekIndexes = availableWeeks.map((w) => w.weekIndex);
  const weekIndex =
    Number.isFinite(requestedWeek) && availableWeekIndexes.includes(requestedWeek)
      ? requestedWeek
      : availableWeekIndexes[0] ?? rankingWeek.weekIndex;
  const currentMeta = availableWeeks.find((w) => w.weekIndex === weekIndex);

  const snapshotRow = await prisma.globalSnapshot.findUnique({ where: { weekIndex } });
  const snapshot = snapshotRow
    ? {
        weekIndex,
        weekLabel: snapshotRow.weekLabel,
        dateRange: snapshotRow.dateRange,
        payload: {
          weeklySongs: snapshotRow.weeklySongs as unknown as Awaited<ReturnType<typeof getOrCreateRankingWeekSnapshot>>["payload"]["weeklySongs"],
          weeklyArtists: snapshotRow.weeklyArtists as unknown as Awaited<ReturnType<typeof getOrCreateRankingWeekSnapshot>>["payload"]["weeklyArtists"],
          overallSongs: snapshotRow.overallSongs as unknown as Awaited<ReturnType<typeof getOrCreateRankingWeekSnapshot>>["payload"]["overallSongs"],
          overallArtists: snapshotRow.overallArtists as unknown as Awaited<ReturnType<typeof getOrCreateRankingWeekSnapshot>>["payload"]["overallArtists"],
        },
      }
    : {
        weekIndex,
        weekLabel: currentMeta?.weekLabel ?? rankingWeek.weekLabel,
        dateRange: currentMeta?.dateRange ?? rankingWeek.dateRange,
        payload: await computeGlobalSnapshotData(weekIndex),
      };
  const weekNow = snapshot.weekLabel;
  const weekRangeNow = snapshot.dateRange;
  const globalSongs = await hydrateSongCovers(snapshot.payload.weeklySongs);
  const overallSongs = await hydrateSongCovers(snapshot.payload.overallSongs);
  const topArtists = snapshot.payload.weeklyArtists;
  const topArtistsOverall = snapshot.payload.overallArtists;
  const uniqueParadas = await prisma.chart.count({ where: { weekIndex } });
  const currentIndexInList = availableWeekIndexes.indexOf(weekIndex);
  const newerWeek = currentIndexInList > 0 ? availableWeekIndexes[currentIndexInList - 1] : null;
  const olderWeek =
    currentIndexInList >= 0 && currentIndexInList < availableWeekIndexes.length - 1
      ? availableWeekIndexes[currentIndexInList + 1]
      : null;
  const prevSnapshotRow = olderWeek
    ? await prisma.globalSnapshot.findUnique({ where: { weekIndex: olderWeek } })
    : null;
  const prevWeeklySongs = prevSnapshotRow
    ? (prevSnapshotRow.weeklySongs as unknown as typeof globalSongs)
    : [];

  function songKey(song: { spotifyId?: string | null; title: string; artist: string }): string {
    if (song.spotifyId) return `spotify:${song.spotifyId}`;
    return `local:${song.title.trim().toLowerCase()}|${song.artist.trim().toLowerCase()}`;
  }
  const currentKeySet = new Set(globalSongs.map((s) => songKey(s.song)));
  const weeklyDropoutsRaw = prevWeeklySongs.filter((s) => !currentKeySet.has(songKey(s.song)));
  const weeklyDropouts = await hydrateSongCovers(weeklyDropoutsRaw);

  const imageMap = await resolveArtistImages(
    [...topArtists, ...topArtistsOverall].map((a) => ({ name: a.name, spotifyId: a.spotifyId }))
  );
  const topArtistsWithImages = topArtists.map((a) => ({
    ...a,
    imageUrl: imageMap.get(a.name) ?? null,
  }));
  const topArtistsOverallWithImages = topArtistsOverall.map((a) => ({
    ...a,
    imageUrl: imageMap.get(a.name) ?? null,
  }));

  const FAQ_GLOBAL = [
    {
      q: "Como o Global 100 é calculado?",
      a: `Cada música recebe pontos conforme a posição em que aparece nas paradas pessoais dos usuários. Quanto mais alta a posição e mais usuários incluem a música, mais pontos ela acumula. A soma desses pontos determina a classificação final no ranking semanal global.`,
    },
    {
      q: "Com que frequência a parada é atualizada?",
      a: "O Global 100 é consolidado toda segunda-feira às 01h00 (horário de Brasília), refletindo as charts publicadas pelos usuários durante a semana anterior. O histórico de semanas anteriores também está disponível para consulta.",
    },
    {
      q: "Como participar da parada global?",
      a: "Basta criar uma conta no ChartFM e publicar sua parada pessoal semanal. Assim que você submete sua chart, as músicas escolhidas entram automaticamente no cálculo do ranking global daquela semana.",
    },
    {
      q: "As charts pessoais influenciam o ranking?",
      a: "Sim, diretamente. Cada parada publicada por um usuário contribui para o Global 100. Quanto mais curadores incluem uma música em suas charts, maior o impacto dela no ranking coletivo. É a democracia musical em ação.",
    },
    {
      q: "A parada global é igual às charts de streaming?",
      a: "Não. O Global 100 do ChartFM não mede reproduções automáticas nem algoritmos de plataformas. Cada entrada representa uma escolha deliberada e intencional de um usuário real. Isso torna o ranking mais representativo do gosto musical genuíno da comunidade.",
    },
  ];

  return (
    <Shell title="Global 100">

      {/* ===== BLOCO EDITORIAL PRINCIPAL ===== */}
      <section style={{ marginBottom: 48, maxWidth: 820 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 16 }}>
          A parada musical coletiva do ChartFM
        </h2>

        <p style={{ fontSize: 15, lineHeight: 1.8, color: "var(--text-muted)", margin: "0 0 14px 0" }}>
          O Global 100 do ChartFM reúne as músicas mais populares da comunidade com base nas paradas pessoais publicadas pelos usuários semanalmente. A lista representa uma visão coletiva do que está sendo mais ouvido, compartilhado e comentado dentro da plataforma.
        </p>

        <p style={{ fontSize: 15, lineHeight: 1.8, color: "var(--text-muted)", margin: 0 }}>
          Inspirada nas grandes charts musicais internacionais, a parada global combina diferentes gostos, estilos e tendências em um único ranking atualizado toda semana. Cada posição é calculada a partir da atividade da comunidade: charts semanais publicadas, posições escolhidas por cada curador e o engajamento gerado pelas músicas dentro da plataforma. O resultado é uma parada dinâmica onde hits populares convivem com artistas emergentes, descobertas independentes e músicas que crescem organicamente entre fãs.
        </p>
      </section>

      {/* ===== COMO FUNCIONA ===== */}
      <section style={{ marginBottom: 48 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.025em", marginBottom: 8 }}>
          Como funciona a Parada Global
        </h2>
        <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.6, maxWidth: 700 }}>
          O ranking utiliza dados das charts pessoais enviadas pelos usuários do ChartFM. Conforme músicas aparecem nas listas semanais da comunidade, elas acumulam pontos que determinam suas posições na parada coletiva. As atualizações refletem mudanças reais no comportamento dos usuários, permitindo que novos lançamentos, músicas virais e clássicos revisitados disputem espaço lado a lado.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 16 }}>
          {[
            { icon: <Music size={20} />, title: "Cada posição vale pontos", desc: "A música na 1ª posição de uma parada vale mais pontos que a 10ª. Isso premia as músicas que os usuários mais valorizam, não apenas as mais listadas." },
            { icon: <Users size={20} />, title: "Mais curadores = mais força", desc: "Quanto mais usuários independentes incluem uma música em suas paradas, maior o impacto no ranking global. Um hit genuíno sobe naturalmente." },
            { icon: <BarChart2 size={20} />, title: "Atualizado toda semana", desc: "A consolidação ocorre toda segunda-feira. Novas entradas, subidas e quedas refletem o gosto da comunidade naquele período específico." },
            { icon: <TrendingUp size={20} />, title: "Histórico preservado", desc: "Cada semana gera um snapshot permanente. É possível acompanhar como o ranking evoluiu ao longo do tempo e descobrir como artistas ascenderam." },
          ].map((item) => (
            <div key={item.title} style={{ background: "var(--surface)", border: "1px solid var(--divider)", borderRadius: 14, padding: "18px 20px" }}>
              <div style={{ color: "#FA243C", marginBottom: 10 }}>{item.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{item.title}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>{item.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== HERO COM STATS ===== */}
      <GlobalHero
        weekNow={weekNow}
        weekRangeNow={weekRangeNow}
        uniqueParadas={uniqueParadas}
        songsCount={globalSongs.length}
        olderWeek={olderWeek}
        newerWeek={newerWeek}
      />

      {/* ===== RANKINGS (TABS INTERATIVAS) ===== */}
      <section style={{ marginBottom: 52 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.025em", marginBottom: 8 }}>
          Rankings da semana {weekNow}
        </h2>
        <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.6 }}>
          Abaixo estão os rankings consolidados de músicas e artistas com base nas paradas publicadas na semana {weekRangeNow}. Cada entrada representa a agregação de {uniqueParadas} paradas pessoais distintas publicadas pela comunidade do ChartFM.
        </p>
        <GlobalTabs
          weeklySongs={globalSongs}
          weeklyArtists={topArtistsWithImages}
          overallSongs={overallSongs}
          overallArtists={topArtistsOverallWithImages}
          weeklyDropouts={weeklyDropouts}
        />
      </section>

      {/* ===== FAQ ===== */}
      <section
        style={{
          borderTop: "1px solid var(--divider)",
          paddingTop: 40,
          maxWidth: 820,
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.025em", marginBottom: 24, display: "flex", alignItems: "center", gap: 8 }}>
          <BookOpen size={18} color="#FA243C" />
          Perguntas frequentes sobre o Global 100
        </h2>
        <div style={{ display: "flex", flexDirection: "column" }}>
          {FAQ_GLOBAL.map((item, i) => (
            <div
              key={item.q}
              style={{
                borderTop: i === 0 ? "1px solid var(--divider)" : "none",
                borderBottom: "1px solid var(--divider)",
                padding: "20px 0",
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 8 }}>{item.q}</div>
              <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.75, margin: 0 }}>{item.a}</p>
            </div>
          ))}
        </div>
      </section>
    </Shell>
  );
}
