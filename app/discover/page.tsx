import type { Metadata } from "next";
import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth-options";
import { prisma } from "@/lib/prisma";
import { Shell } from "@/components/layout/Shell";
import { Avatar } from "@/components/ui/Avatar";
import { FollowButton } from "@/components/ui/FollowButton";
import { HotTabs } from "./HotTabs";
import { getPreviousClosedWeekDate, getRankingWeekReference, buildWeekIndexFromDate } from "@/lib/chart-week";
import { TrendingUp, Users, Music, Headphones, Radio, BarChart2, Star, BookOpen } from "lucide-react";

export const metadata: Metadata = {
  title: "Descobrir Músicas, Artistas e Curadores | ChartFM",
  description:
    "Descubra novas músicas, artistas em ascensão e curadores em destaque no ChartFM. Explore charts semanais da comunidade, rankings por gênero e tendências musicais atualizadas toda semana.",
  alternates: { canonical: "/discover" },
};

function weeklyScore(likes: number, comments: number, reposts: number): number {
  return likes * 1 + comments * 2 + reposts * 3;
}

const GENRES = [
  { slug: "pop", name: "Pop", color: ["#FA243C", "#FF5858"], letter: "P", tags: ["pop"] },
  { slug: "hip-hop-rap", name: "Hip-Hop/Rap", color: ["#1D1D1F", "#4A4A4F"], letter: "H", tags: ["hip hop", "rap", "trap"] },
  { slug: "sertanejo", name: "Sertanejo", color: ["#E36414", "#FFD166"], letter: "S", tags: ["sertanejo"] },
  { slug: "rnb-soul", name: "R&B/Soul", color: ["#6A0572", "#AB83A1"], letter: "R", tags: ["r&b", "soul", "neo soul"] },
  { slug: "indie-alt", name: "Indie/Alt", color: ["#06D6A0", "#073B4C"], letter: "I", tags: ["indie", "alternative", "alt"] },
  { slug: "funk", name: "Funk", color: ["#EF476F", "#FFD166"], letter: "F", tags: ["funk"] },
  { slug: "eletronica", name: "Eletrônica", color: ["#8338EC", "#3A86FF"], letter: "E", tags: ["electronic", "dance", "house", "techno", "edm", "eletronica", "eletronic"] },
  { slug: "k-pop", name: "K-Pop", color: ["#FB5607", "#FFBE0B"], letter: "K", tags: ["k-pop", "kpop"] },
];

const HOW_IT_WORKS = [
  {
    icon: <BarChart2 size={20} />,
    title: "Charts publicadas toda semana",
    desc: "Usuários publicam suas paradas pessoais semanalmente. O Discover agrega essas escolhas para revelar tendências reais dentro da comunidade.",
  },
  {
    icon: <TrendingUp size={20} />,
    title: "Rankings construídos pela comunidade",
    desc: "Artistas e músicas sobem no ranking conforme mais usuários os incluem em suas paradas. Sem algoritmo opaco — só o gosto real das pessoas.",
  },
  {
    icon: <Users size={20} />,
    title: "Curadoria humana, não automática",
    desc: "Cada curador é uma pessoa real com um gosto musical definido. Seguir curadores permite descobrir músicas através de quem pensa parecido com você.",
  },
  {
    icon: <Music size={20} />,
    title: "Exploração por gênero",
    desc: "Filtre artistas e músicas por gênero para descobrir o que está em alta dentro de um estilo específico, da eletrônica ao sertanejo.",
  },
];

const FAQ = [
  {
    q: "O que é o Discover do ChartFM?",
    a: "O Discover é a página central de descoberta do ChartFM. Nela você encontra curadores em destaque da semana, rankings de artistas e músicas mais chartadas pela comunidade, e atalhos para explorar por gênero musical. Todo o conteúdo é atualizado semanalmente com base nas paradas publicadas pelos usuários.",
  },
  {
    q: "Como os conteúdos aparecem no Discover?",
    a: "Os rankings são gerados automaticamente a partir das paradas pessoais publicadas pelos usuários. Quanto mais pessoas incluem um artista ou música em sua parada semanal, maior a posição no ranking. Os curadores em destaque são selecionados com base na atividade e engajamento das charts da semana.",
  },
  {
    q: "Como descobrir novos artistas no ChartFM?",
    a: "A forma mais eficiente é seguir curadores cujo gosto você já admira. Quando eles publicam novas paradas, você pode explorar artistas e músicas que ainda não conhecia. Também é possível navegar por gênero para encontrar tendências dentro de um estilo específico.",
  },
  {
    q: "O que são curadores no ChartFM?",
    a: "Curadores são usuários que publicam paradas musicais semanais de forma consistente. Cada chart é uma seleção pessoal e deliberada das músicas que mais marcaram a semana do curador. Seguir um curador é uma forma de acompanhar o gosto musical de alguém de confiança.",
  },
  {
    q: "Com que frequência o Discover é atualizado?",
    a: "O ranking de artistas e músicas é atualizado toda segunda-feira às 01h00 (horário de Brasília), junto com a consolidação semanal das paradas. Os curadores em destaque refletem a atividade da semana corrente e podem mudar conforme novas charts são publicadas.",
  },
];

export default async function DiscoverPage() {
  const nowBRT = new Date(Date.now() - 3 * 60 * 60 * 1000);
  const rankingWeek = getRankingWeekReference(nowBRT);
  const prevWeekDate = new Date(getPreviousClosedWeekDate(nowBRT).getTime() - 7 * 24 * 60 * 60 * 1000);
  const prevWeekIndex = buildWeekIndexFromDate(prevWeekDate);
  return loadPageData(rankingWeek.weekIndex, rankingWeek.weekLabel, prevWeekIndex);
}

type ArtistWeekRow = {
  name: string;
  spotifyId?: string | null;
  imageUrl?: string | null;
  listeners: number;
  users: number;
  status: "new" | "return" | "up" | "down" | "same";
  delta: number | null;
};

type SongWeekRow = {
  title: string;
  artist: string;
  spotifyId?: string | null;
  artistSpotifyId?: string | null;
  users: number;
  status: "new" | "return" | "up" | "down" | "same";
  delta: number | null;
};

function normalizeArtistName(raw: string): string {
  return raw.trim().replace(/\s+/g, " ");
}

async function loadPageData(
  weekIndex: number,
  weekLabel: string,
  prevWeekIndex: number,
) {
  const session = await getServerSession(authOptions);
  const [curatorCharts, followRows, weeklyEntries, previousEntries] = await Promise.all([
    prisma.chart.findMany({
      where: { weekIndex, isPublished: true },
      orderBy: [{ publishedAt: "asc" }],
      take: 5,
      select: {
        id: true,
        likes: true,
        comments: true,
        reposts: true,
        user: {
          select: {
            id: true,
            handle: true,
            name: true,
            bio: true,
            image: true,
            avatarColor: true,
            streak: true,
          },
        },
      },
    }),
    session?.user?.id
      ? prisma.userFollow.findMany({
          where: { followerId: session.user.id },
          select: { followingId: true },
        })
      : Promise.resolve([] as Array<{ followingId: string }>),
    prisma.chartEntry.findMany({
      where: { chart: { weekIndex, isPublished: true } },
      select: {
        position: true,
        chartId: true,
        chart: {
          select: { userId: true },
        },
        song: {
          select: {
            title: true,
            artist: true,
            spotifyId: true,
            artistSpotifyId: true,
            artistRef: { select: { name: true, spotifyId: true, genres: true, imageUrl: true } },
          },
        },
      },
    }),
    prisma.chartEntry.findMany({
      where: { chart: { weekIndex: prevWeekIndex, isPublished: true } },
      select: {
        position: true,
        chartId: true,
        chart: {
          select: { userId: true },
        },
        song: {
          select: {
            title: true,
            artist: true,
            spotifyId: true,
            artistSpotifyId: true,
            artistRef: { select: { name: true, spotifyId: true, genres: true, imageUrl: true } },
          },
        },
      },
    }),
  ]);

  const followingIds = new Set(followRows.map((r) => r.followingId));
  const rankedCurators = curatorCharts
    .map((row) => ({
      ...row,
      score: weeklyScore(row.likes, row.comments, row.reposts),
    }))
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.likes !== a.likes) return b.likes - a.likes;
      if (b.comments !== a.comments) return b.comments - a.comments;
      return b.reposts - a.reposts;
    })
    .slice(0, 5);

  const aggregateArtists = (rows: typeof weeklyEntries) => {
    const map = new Map<string, { points: number; chartIds: Set<string>; userIds: Set<string>; spotifyId: string | null; imageUrl: string | null }>();
    for (const row of rows) {
      const name = normalizeArtistName(row.song.artistRef?.name || row.song.artist);
      const sid = row.song.artistRef?.spotifyId ?? row.song.artistSpotifyId ?? null;
      const img = row.song.artistRef?.imageUrl ?? null;
      const cur = map.get(name) ?? { points: 0, chartIds: new Set<string>(), userIds: new Set<string>(), spotifyId: null, imageUrl: null };
      cur.points += 1;
      cur.chartIds.add(row.chartId);
      cur.userIds.add(row.chart.userId);
      if (sid) cur.spotifyId = cur.spotifyId ?? sid;
      if (img) cur.imageUrl = cur.imageUrl ?? img;
      map.set(name, cur);
    }
    return map;
  };

  const aggregateSongsByUsers = (rows: typeof weeklyEntries) => {
    const map = new Map<string, { title: string; artist: string; spotifyId: string | null; artistSpotifyId: string | null; users: Set<string> }>();
    for (const row of rows) {
      const title = row.song.title.trim();
      const artist = normalizeArtistName(row.song.artistRef?.name || row.song.artist);
      const key = `${title.toLowerCase()}|${artist.toLowerCase()}`;
      const cur = map.get(key) ?? { title, artist, spotifyId: row.song.spotifyId ?? null, artistSpotifyId: row.song.artistRef?.spotifyId ?? row.song.artistSpotifyId ?? null, users: new Set<string>() };
      cur.users.add(row.chart.userId);
      map.set(key, cur);
    }
    return map;
  };

  const currentMap = aggregateArtists(weeklyEntries);
  const previousMap = aggregateArtists(previousEntries);

  const currentSorted = [...currentMap.entries()]
    .map(([name, stats]) => ({
      name,
      spotifyId: stats.spotifyId,
      imageUrl: stats.imageUrl,
      listeners: stats.chartIds.size,
      users: stats.userIds.size,
      totalPoints: stats.points,
    }))
    .sort((a, b) => b.totalPoints - a.totalPoints || b.listeners - a.listeners || a.users - b.users || a.name.localeCompare(b.name, "pt-BR"))
    .slice(0, 10);

  const prevPosByName = new Map(
    [...previousMap.entries()]
      .map(([name, stats]) => ({ name, points: stats.points, listeners: stats.chartIds.size, users: stats.userIds.size }))
      .sort((a, b) => b.points - a.points || b.listeners - a.listeners || b.users - a.users || a.name.localeCompare(b.name, "pt-BR"))
      .map((row, idx) => [row.name, idx + 1]),
  );

  const trendingArtists: ArtistWeekRow[] = currentSorted.map((row, idx) => {
    const position = idx + 1;
    const prevPos = prevPosByName.get(row.name) ?? null;
    const delta = prevPos === null ? null : prevPos - position;
    const status: ArtistWeekRow["status"] =
      prevPos === null ? "new" : delta === 0 ? "same" : (delta ?? 0) > 0 ? "up" : "down";
    return { name: row.name, spotifyId: row.spotifyId, imageUrl: row.imageUrl, listeners: row.listeners, users: row.users, status, delta };
  });

  const currentSongsMap = aggregateSongsByUsers(weeklyEntries);
  const previousSongsMap = aggregateSongsByUsers(previousEntries);
  const currentSongsSorted = [...currentSongsMap.entries()]
    .map(([key, v]) => ({ key, title: v.title, artist: v.artist, spotifyId: v.spotifyId, artistSpotifyId: v.artistSpotifyId, users: v.users.size }))
    .sort((a, b) => b.users - a.users || a.title.localeCompare(b.title, "pt-BR"))
    .slice(0, 10);
  const prevSongsPosByKey = new Map(
    [...previousSongsMap.entries()]
      .map(([key, v]) => ({ key, users: v.users.size, title: v.title }))
      .sort((a, b) => b.users - a.users || a.title.localeCompare(b.title, "pt-BR"))
      .map((row, idx) => [row.key, idx + 1]),
  );
  const trendingSongs: SongWeekRow[] = currentSongsSorted.map((row, idx) => {
    const position = idx + 1;
    const prevPos = prevSongsPosByKey.get(row.key) ?? null;
    const delta = prevPos === null ? null : prevPos - position;
    const status: SongWeekRow["status"] =
      prevPos === null ? "new" : delta === 0 ? "same" : (delta ?? 0) > 0 ? "up" : "down";
    return { title: row.title, artist: row.artist, spotifyId: row.spotifyId, artistSpotifyId: row.artistSpotifyId, users: row.users, status, delta };
  });

  return (
    <Shell title="Descobrir" subtitle="Explore músicas, artistas e curadores">

      {/* ===== BLOCO EDITORIAL PRINCIPAL ===== */}
      <section style={{ marginBottom: 52, maxWidth: 820 }}>
        <h2 style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 16 }}>
          Descubra novas músicas no ChartFM
        </h2>

        <p style={{ fontSize: 15, lineHeight: 1.8, color: "var(--text-muted)", margin: "0 0 14px 0" }}>
          O Discover do ChartFM foi criado para ajudar fãs de música a explorar novos artistas, álbuns, charts e tendências dentro da comunidade. Todos os dias, usuários compartilham suas paradas pessoais, avaliações e descobertas musicais, criando um ambiente dinâmico onde diferentes estilos e gêneros convivem em um único lugar. O resultado é um retrato honesto do que a comunidade está ouvindo — não o que um algoritmo decidiu promover.
        </p>

        <p style={{ fontSize: 15, lineHeight: 1.8, color: "var(--text-muted)", margin: "0 0 14px 0" }}>
          Diferente de plataformas baseadas apenas em algoritmos automáticos, o Discover do ChartFM é construído a partir da atividade real da comunidade. Cada chart publicada, review escrita e avaliação enviada ajuda a destacar novos lançamentos, artistas emergentes e clássicos revisitados pelos usuários. Isso significa que os rankings que você vê aqui refletem escolhas humanas e intencionais — não contagens de reprodução passiva.
        </p>

        <p style={{ fontSize: 15, lineHeight: 1.8, color: "var(--text-muted)", margin: "0 0 14px 0" }}>
          Através da página Discover, é possível acompanhar os artistas mais comentados do momento, encontrar curadores com gosto musical parecido com o seu, explorar charts semanais de outros usuários e descobrir músicas que estão crescendo organicamente dentro da plataforma. Os rankings são atualizados toda semana, então sempre há algo novo para explorar.
        </p>

        <p style={{ fontSize: 15, lineHeight: 1.8, color: "var(--text-muted)", margin: 0 }}>
          Seja para descobrir novos sons, acompanhar tendências musicais ou explorar o gosto coletivo da comunidade, o Discover funciona como um espaço central para navegar pelo universo musical do ChartFM. Curadores reais, rankings transparentes e exploração por gênero tornam a descoberta de música uma experiência mais rica e menos aleatória.
        </p>
      </section>

      {/* ===== COMO FUNCIONA ===== */}
      <section style={{ marginBottom: 52 }}>
        <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.025em", marginBottom: 6 }}>
          Como funciona o Discover
        </h2>
        <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.6 }}>
          O sistema de descoberta do ChartFM utiliza dados das charts pessoais, avaliações e atividade da comunidade para destacar conteúdos relevantes. Conforme usuários adicionam músicas às suas paradas semanais e interagem com artistas, novas tendências surgem organicamente dentro da plataforma.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 16 }}>
          {HOW_IT_WORKS.map((step) => (
            <div
              key={step.title}
              style={{
                background: "var(--surface)",
                border: "1px solid var(--divider)",
                borderRadius: 14,
                padding: "18px 20px",
              }}
            >
              <div style={{ color: "#FA243C", marginBottom: 10 }}>{step.icon}</div>
              <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 6 }}>{step.title}</div>
              <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>{step.desc}</div>
            </div>
          ))}
        </div>
      </section>

      {/* ===== CURADORES EM DESTAQUE ===== */}
      <section style={{ marginBottom: 52 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, marginBottom: 8 }}>
          <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.025em", margin: 0 }}>Curadores em destaque</h2>
          <Link href="/discover/curators" style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)", textDecoration: "none" }}>
            Ver top 20 →
          </Link>
        </div>
        <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.6 }}>
          Curadores são usuários que publicam paradas musicais com regularidade e consistência. Seguir um curador é a forma mais direta de descobrir música nova através de alguém cujo gosto você confia. Os destaques abaixo refletem a atividade e o engajamento da semana {weekLabel}.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 16 }}>
          {rankedCurators.map((row) => (
            <div key={row.user.id} style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", padding: 24, display: "flex", flexDirection: "column", alignItems: "center", gap: 12 }}>
              <div style={{ position: "relative" }}>
                <Avatar user={{ name: row.user.name, avatar: row.user.avatarColor }} imageUrl={row.user.image} size={72} />
                <div style={{
                  position: "absolute", bottom: -4, right: -4,
                  background: "var(--accent)", color: "white", fontSize: 11, fontWeight: 700,
                  padding: "2px 6px", borderRadius: 8, border: "2px solid var(--surface)",
                  display: "flex", alignItems: "center", gap: 2,
                }}>
                  Destaque
                </div>
              </div>
              <div style={{ textAlign: "center" }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>{row.user.name}</div>
                <div style={{ fontSize: 13, color: "var(--text-muted)" }}>@{row.user.handle}</div>
                <div style={{ fontSize: 13, color: "var(--text-subtle)", marginTop: 6, lineHeight: 1.5, height: "2.8em", overflow: "hidden" }}>{row.user.bio ?? "Curador em destaque da semana."}</div>
                <Link href={`/chart/${row.id}`} style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)", textDecoration: "none", marginTop: 8, display: "inline-block" }}>
                  Ver parada
                </Link>
              </div>
              <FollowButton targetId={row.user.id} initialFollowing={followingIds.has(row.user.id)} variant="dark" size="sm" />
            </div>
          ))}
        </div>
      </section>

      {/* ===== GÊNEROS ===== */}
      <section style={{ marginBottom: 52 }}>
        <h2 style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-0.025em", marginBottom: 8 }}>Explorar por gênero</h2>
        <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 20, lineHeight: 1.6 }}>
          Cada gênero musical tem seu próprio espaço de exploração no ChartFM. Filtre artistas, músicas e curadores por estilo para encontrar tendências específicas — do funk ao K-Pop, do indie ao eletrônico. Os rankings por gênero são construídos a partir das charts dos usuários que mais ouvem cada estilo.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {GENRES.map((g) => (
            <Link
              key={g.name}
              href={`/discover/genre/${encodeURIComponent(g.slug)}`}
              style={{
                height: 120,
                borderRadius: 16,
                background: `linear-gradient(135deg, ${g.color[0]}, ${g.color[1]})`,
                padding: "20px 20px",
                color: "white",
                position: "relative",
                overflow: "hidden",
                cursor: "pointer",
                textDecoration: "none",
                border: "2px solid transparent",
                boxShadow: "none",
              }}
            >
              <div style={{ fontSize: 16, fontWeight: 700, position: "relative", zIndex: 1 }}>{g.name}</div>
              <div style={{
                position: "absolute", top: -10, right: -4,
                fontSize: 96, fontWeight: 900, color: "rgba(255,255,255,0.15)",
                lineHeight: 1, userSelect: "none",
              }}>
                {g.letter}
              </div>
            </Link>
          ))}
        </div>
      </section>

      {/* ===== EM ALTA ===== */}
      <section style={{ marginBottom: 52 }}>
        <p style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 12, lineHeight: 1.6 }}>
          Ranking semanal consolidado na segunda-feira às 01h00 (BRT). Artistas e músicas são ranqueados pelo número de usuários que os incluíram em suas paradas pessoais na semana {weekLabel}.
        </p>
        <HotTabs artists={trendingArtists} songs={trendingSongs} />
      </section>

      {/* ===== FAQ ===== */}
      <section
        style={{
          borderTop: "1px solid var(--divider)",
          paddingTop: 40,
          marginBottom: 8,
          maxWidth: 820,
        }}
      >
        <h2 style={{ fontSize: 18, fontWeight: 700, letterSpacing: "-0.025em", marginBottom: 24, display: "flex", alignItems: "center", gap: 8 }}>
          <BookOpen size={18} color="#FA243C" />
          Perguntas frequentes
        </h2>
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {FAQ.map((item, i) => (
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
