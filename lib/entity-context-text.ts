/**
 * Parágrafos de contexto para páginas dinâmicas (música, artista, álbum, parada, comunidade).
 * Cada frase só entra se o dado existir — nada de números inventados. Usado para SEO/AdSense:
 * cada página precisa de texto único derivado dos dados reais, não só listas/rankings nus.
 */

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

export function buildSongContext(input: {
  title: string;
  artist: string;
  album: string;
  chartEntries: number;
  uniqueUsers: number;
  totalPoints: number;
  peak: number;
  weeksTop100: number;
  firstAppearanceRange: string | null;
}): string {
  const { title, artist, album, chartEntries, uniqueUsers, totalPoints, peak, weeksTop100, firstAppearanceRange } = input;
  const sentences: string[] = [];

  const albumPart = album.trim() ? `, do álbum ${album.trim()}` : "";
  sentences.push(`"${title}" é uma música de ${artist}${albumPart}.`);

  if (chartEntries > 0) {
    const entriesPart = `entrou em ${chartEntries} ${pluralize(chartEntries, "parada", "paradas")}`;
    const usersPart = uniqueUsers > 0 ? ` de ${uniqueUsers} ${pluralize(uniqueUsers, "usuário diferente", "usuários diferentes")}` : "";
    const firstPart = firstAppearanceRange ? `, a primeira delas na semana de ${firstAppearanceRange}` : "";
    sentences.push(`No ChartFM, ela já ${entriesPart}${usersPart}${firstPart}.`);
  }

  if (peak > 0) {
    const weeksPart = weeksTop100 > 0 ? `, com ${weeksTop100} ${pluralize(weeksTop100, "semana", "semanas")} no ranking` : "";
    sentences.push(`Sua melhor posição no Global 100 foi #${peak}${weeksPart}.`);
  }

  if (totalPoints > 0) {
    sentences.push(`Ao todo, acumula ${totalPoints.toLocaleString("pt-BR")} pontos no histórico da plataforma.`);
  }

  return sentences.join(" ");
}

export function buildArtistContext(input: {
  name: string;
  songCount: number;
  listenersCount: number;
  totalPoints: number;
  bestSong: { title: string; peak: number } | null;
  thisWeekSongCount: number;
  thisWeekTopSong: { title: string; position: number } | null;
}): string {
  const { name, songCount, listenersCount, totalPoints, bestSong, thisWeekSongCount, thisWeekTopSong } = input;
  const sentences: string[] = [];

  if (songCount > 0) {
    sentences.push(`${name} tem ${songCount} ${pluralize(songCount, "música registrada", "músicas registradas")} no ChartFM.`);
  }

  if (bestSong && bestSong.peak > 0) {
    sentences.push(`Sua música mais bem colocada é "${bestSong.title}", que chegou ao #${bestSong.peak} do Global 100.`);
  }

  if (listenersCount > 0) {
    const pointsPart = totalPoints > 0 ? `, somando ${totalPoints.toLocaleString("pt-BR")} pontos ao todo` : "";
    sentences.push(`${listenersCount} ${pluralize(listenersCount, "usuário diferente já incluiu", "usuários diferentes já incluíram")} músicas do artista em suas paradas${pointsPart}.`);
  }

  if (thisWeekSongCount > 0) {
    const topPart = thisWeekTopSong ? `, sendo "${thisWeekTopSong.title}" a mais bem colocada (#${thisWeekTopSong.position})` : "";
    sentences.push(`Nesta semana, ${thisWeekSongCount} ${pluralize(thisWeekSongCount, "música do artista aparece", "músicas do artista aparecem")} em paradas da comunidade${topPart}.`);
  }

  return sentences.join(" ");
}

export function buildAlbumContext(input: {
  album: string;
  artist: string;
  releaseYear: string | null;
  trackCount: number;
  rankedTrackCount: number;
  bestSong: { title: string; peak: number } | null;
}): string {
  const { album, artist, releaseYear, trackCount, rankedTrackCount, bestSong } = input;
  const sentences: string[] = [];

  const releasePart = releaseYear ? `, lançado em ${releaseYear}` : "";
  const trackPart = trackCount > 0 ? `, com ${trackCount} ${pluralize(trackCount, "faixa registrada", "faixas registradas")} no ChartFM` : "";
  sentences.push(`${album} é um álbum de ${artist}${releasePart}${trackPart}.`);

  if (rankedTrackCount > 0) {
    const bestPart = bestSong && bestSong.peak > 0
      ? `, a de melhor desempenho é "${bestSong.title}", com pico no #${bestSong.peak} do Global 100`
      : "";
    sentences.push(`${rankedTrackCount} ${pluralize(rankedTrackCount, "dessas faixas já apareceu", "dessas faixas já apareceram")} em paradas de usuários${bestPart}.`);
  }

  return sentences.join(" ");
}

export function buildChartContext(input: {
  userName: string;
  weekLabel: string;
  entryCount: number;
  newEntryCount: number;
  topSongTitle: string | null;
  topSongStreak: number | null;
  chartNumber: number | null;
}): string {
  const { userName, weekLabel, entryCount, newEntryCount, topSongTitle, topSongStreak, chartNumber } = input;
  const sentences: string[] = [];

  sentences.push(`Parada de ${userName} para a semana de ${weekLabel}, com ${entryCount} ${pluralize(entryCount, "música", "músicas")}.`);

  if (newEntryCount > 0) {
    const streakPart = topSongTitle && topSongStreak && topSongStreak > 1
      ? `, e "${topSongTitle}" segue no topo pela ${topSongStreak}ª semana`
      : "";
    sentences.push(`${newEntryCount} ${pluralize(newEntryCount, "faixa estreia", "faixas estreiam")} na lista em relação à semana anterior${streakPart}.`);
  }

  if (chartNumber && chartNumber > 0) {
    sentences.push(`Esta é a ${chartNumber}ª parada publicada por ${userName} no ChartFM.`);
  }

  return sentences.join(" ");
}

export function buildCommunityContext(input: {
  name: string;
  theme: string | null;
  memberCount: number;
  foundedLabel: string | null;
  chartCount: number;
  topSong: { title: string; artist: string } | null;
  weekLabel: string | null;
}): string {
  const { name, theme, memberCount, foundedLabel, chartCount, topSong, weekLabel } = input;
  const sentences: string[] = [];

  const themePart = theme ? ` em torno de ${theme}` : "";
  sentences.push(`${name} reúne ${memberCount} ${pluralize(memberCount, "membro", "membros")}${themePart}.`);

  const foundedPart = foundedLabel ? `A comunidade existe desde ${foundedLabel}` : "A comunidade";
  if (chartCount > 0) {
    sentences.push(`${foundedPart} e já publicou ${chartCount} ${pluralize(chartCount, "parada coletiva", "paradas coletivas")}.`);
  }

  if (topSong && weekLabel) {
    sentences.push(`Na semana de ${weekLabel}, a música mais votada pelos membros foi "${topSong.title}", de ${topSong.artist}.`);
  }

  return sentences.join(" ");
}
