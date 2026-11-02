/**
 * Parágrafos de contexto para páginas dinâmicas (música, artista, álbum, parada, comunidade).
 * Cada frase só entra se o dado existir — nada de números inventados. Usado para SEO/AdSense:
 * cada página precisa de texto único derivado dos dados reais, não só listas/rankings nus.
 */

import type { Locale } from "@/lib/i18n/config";
import { releaseTypeNoun } from "@/lib/release-type";

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

function englishOrdinal(n: number): string {
  const mod100 = n % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${n}th`;
  switch (n % 10) {
    case 1:
      return `${n}st`;
    case 2:
      return `${n}nd`;
    case 3:
      return `${n}rd`;
    default:
      return `${n}th`;
  }
}

function formatPoints(locale: Locale, points: number): string {
  return points.toLocaleString(locale === "en" ? "en-US" : "pt-BR");
}

export function buildSongContext(
  input: {
    title: string;
    artist: string;
    album: string;
    chartEntries: number;
    uniqueUsers: number;
    totalPoints: number;
    peak: number;
    weeksTop100: number;
    firstAppearanceRange: string | null;
  },
  locale: Locale = "pt-BR",
): string {
  const { title, artist, album, chartEntries, uniqueUsers, totalPoints, peak, weeksTop100, firstAppearanceRange } =
    input;
  const sentences: string[] = [];
  const en = locale === "en";

  if (en) {
    const albumPart = album.trim() ? `, from the album ${album.trim()}` : "";
    sentences.push(`"${title}" is a song by ${artist}${albumPart}.`);
  } else {
    const albumPart = album.trim() ? `, do álbum ${album.trim()}` : "";
    sentences.push(`"${title}" é uma música de ${artist}${albumPart}.`);
  }

  if (chartEntries > 0) {
    if (en) {
      const entriesPart = `appeared on ${chartEntries} ${pluralize(chartEntries, "chart", "charts")}`;
      const usersPart =
        uniqueUsers > 0
          ? ` from ${uniqueUsers} ${pluralize(uniqueUsers, "different user", "different users")}`
          : "";
      const firstPart = firstAppearanceRange ? `, first in ${firstAppearanceRange}` : "";
      sentences.push(`On ChartFM, it has already ${entriesPart}${usersPart}${firstPart}.`);
    } else {
      const entriesPart = `entrou em ${chartEntries} ${pluralize(chartEntries, "parada", "paradas")}`;
      const usersPart =
        uniqueUsers > 0
          ? ` de ${uniqueUsers} ${pluralize(uniqueUsers, "usuário diferente", "usuários diferentes")}`
          : "";
      const firstPart = firstAppearanceRange ? `, a primeira delas na semana de ${firstAppearanceRange}` : "";
      sentences.push(`No ChartFM, ela já ${entriesPart}${usersPart}${firstPart}.`);
    }
  }

  if (peak > 0) {
    if (en) {
      const weeksPart =
        weeksTop100 > 0
          ? `, with ${weeksTop100} ${pluralize(weeksTop100, "week", "weeks")} on the ranking`
          : "";
      sentences.push(`Its best position on the Global 100 was #${peak}${weeksPart}.`);
    } else {
      const weeksPart =
        weeksTop100 > 0
          ? `, com ${weeksTop100} ${pluralize(weeksTop100, "semana", "semanas")} no ranking`
          : "";
      sentences.push(`Sua melhor posição no Global 100 foi #${peak}${weeksPart}.`);
    }
  }

  if (totalPoints > 0) {
    sentences.push(
      en
        ? `Overall, it has accumulated ${formatPoints(locale, totalPoints)} points in the platform's history.`
        : `Ao todo, acumula ${formatPoints(locale, totalPoints)} pontos no histórico da plataforma.`,
    );
  }

  return sentences.join(" ");
}

export function buildArtistContext(
  input: {
    name: string;
    songCount: number;
    listenersCount: number;
    totalPoints: number;
    bestSong: { title: string; peak: number } | null;
    thisWeekSongCount: number;
    thisWeekTopSong: { title: string; position: number } | null;
  },
  locale: Locale = "pt-BR",
): string {
  const { name, songCount, listenersCount, totalPoints, bestSong, thisWeekSongCount, thisWeekTopSong } = input;
  const sentences: string[] = [];
  const en = locale === "en";

  if (songCount > 0) {
    sentences.push(
      en
        ? `${name} has ${songCount} ${pluralize(songCount, "song", "songs")} registered on ChartFM.`
        : `${name} tem ${songCount} ${pluralize(songCount, "música registrada", "músicas registradas")} no ChartFM.`,
    );
  }

  if (bestSong && bestSong.peak > 0) {
    sentences.push(
      en
        ? `Their highest-charting song is "${bestSong.title}", which reached #${bestSong.peak} on the Global 100.`
        : `Sua música mais bem colocada é "${bestSong.title}", que chegou ao #${bestSong.peak} do Global 100.`,
    );
  }

  if (listenersCount > 0) {
    if (en) {
      const pointsPart =
        totalPoints > 0 ? `, totaling ${formatPoints(locale, totalPoints)} points overall` : "";
      sentences.push(
        `${listenersCount} ${pluralize(listenersCount, "different user has", "different users have")} included this artist's songs on their charts${pointsPart}.`,
      );
    } else {
      const pointsPart =
        totalPoints > 0 ? `, somando ${formatPoints(locale, totalPoints)} pontos ao todo` : "";
      sentences.push(
        `${listenersCount} ${pluralize(listenersCount, "usuário diferente já incluiu", "usuários diferentes já incluíram")} músicas do artista em suas paradas${pointsPart}.`,
      );
    }
  }

  if (thisWeekSongCount > 0) {
    if (en) {
      const topPart = thisWeekTopSong
        ? `, with "${thisWeekTopSong.title}" highest (#${thisWeekTopSong.position})`
        : "";
      sentences.push(
        `This week, ${thisWeekSongCount} ${pluralize(thisWeekSongCount, "song by the artist appears", "songs by the artist appear")} on community charts${topPart}.`,
      );
    } else {
      const topPart = thisWeekTopSong
        ? `, sendo "${thisWeekTopSong.title}" a mais bem colocada (#${thisWeekTopSong.position})`
        : "";
      sentences.push(
        `Nesta semana, ${thisWeekSongCount} ${pluralize(thisWeekSongCount, "música do artista aparece", "músicas do artista aparecem")} em paradas da comunidade${topPart}.`,
      );
    }
  }

  return sentences.join(" ");
}

export function buildAlbumContext(
  input: {
    album: string;
    artist: string;
    releaseYear: string | null;
    trackCount: number;
    rankedTrackCount: number;
    bestSong: { title: string; peak: number } | null;
    /** Album.albumType — mesmo valor que define o rótulo da interface. */
    releaseType?: string | null;
  },
  locale: Locale = "pt-BR",
): string {
  const { album, artist, releaseYear, trackCount, rankedTrackCount, bestSong } = input;
  const noun = releaseTypeNoun(input.releaseType, locale);
  const sentences: string[] = [];
  const en = locale === "en";

  if (en) {
    const releasePart = releaseYear ? `, released in ${releaseYear}` : "";
    const trackPart =
      trackCount > 0
        ? `, with ${trackCount} ${pluralize(trackCount, "track", "tracks")} registered on ChartFM`
        : "";
    sentences.push(`${album} is ${noun} by ${artist}${releasePart}${trackPart}.`);
  } else {
    const releasePart = releaseYear ? `, lançado em ${releaseYear}` : "";
    const trackPart =
      trackCount > 0
        ? `, com ${trackCount} ${pluralize(trackCount, "faixa registrada", "faixas registradas")} no ChartFM`
        : "";
    sentences.push(`${album} é ${noun} de ${artist}${releasePart}${trackPart}.`);
  }

  if (rankedTrackCount > 0) {
    if (en) {
      const bestPart =
        bestSong && bestSong.peak > 0
          ? `; the strongest performer is "${bestSong.title}", peaking at #${bestSong.peak} on the Global 100`
          : "";
      sentences.push(
        `${rankedTrackCount} ${pluralize(rankedTrackCount, "of these tracks has", "of these tracks have")} appeared on user charts${bestPart}.`,
      );
    } else {
      const bestPart =
        bestSong && bestSong.peak > 0
          ? `, a de melhor desempenho é "${bestSong.title}", com pico no #${bestSong.peak} do Global 100`
          : "";
      sentences.push(
        `${rankedTrackCount} ${pluralize(rankedTrackCount, "dessas faixas já apareceu", "dessas faixas já apareceram")} em paradas de usuários${bestPart}.`,
      );
    }
  }

  return sentences.join(" ");
}

export function buildChartContext(
  input: {
    userName: string;
    weekLabel: string;
    entryCount: number;
    newEntryCount: number;
    topSongTitle: string | null;
    topSongStreak: number | null;
    chartNumber: number | null;
  },
  locale: Locale = "pt-BR",
): string {
  const { userName, weekLabel, entryCount, newEntryCount, topSongTitle, topSongStreak, chartNumber } = input;
  const sentences: string[] = [];
  const en = locale === "en";

  sentences.push(
    en
      ? `${userName}'s chart for ${weekLabel}, with ${entryCount} ${pluralize(entryCount, "song", "songs")}.`
      : `Parada de ${userName} para a semana de ${weekLabel}, com ${entryCount} ${pluralize(entryCount, "música", "músicas")}.`,
  );

  if (newEntryCount > 0) {
    if (en) {
      const streakPart =
        topSongTitle && topSongStreak && topSongStreak > 1
          ? `, and "${topSongTitle}" holds the top for a ${englishOrdinal(topSongStreak)} week`
          : "";
      sentences.push(
        `${newEntryCount} ${pluralize(newEntryCount, "track debuts", "tracks debut")} on the list compared with the previous week${streakPart}.`,
      );
    } else {
      const streakPart =
        topSongTitle && topSongStreak && topSongStreak > 1
          ? `, e "${topSongTitle}" segue no topo pela ${topSongStreak}ª semana`
          : "";
      sentences.push(
        `${newEntryCount} ${pluralize(newEntryCount, "faixa estreia", "faixas estreiam")} na lista em relação à semana anterior${streakPart}.`,
      );
    }
  }

  if (chartNumber && chartNumber > 0) {
    sentences.push(
      en
        ? `This is ${userName}'s ${englishOrdinal(chartNumber)} chart published on ChartFM.`
        : `Esta é a ${chartNumber}ª parada publicada por ${userName} no ChartFM.`,
    );
  }

  return sentences.join(" ");
}

export function buildCommunityContext(
  input: {
    name: string;
    theme: string | null;
    memberCount: number;
    foundedLabel: string | null;
    chartCount: number;
    topSong: { title: string; artist: string } | null;
    weekLabel: string | null;
  },
  locale: Locale = "pt-BR",
): string {
  const { name, theme, memberCount, foundedLabel, chartCount, topSong, weekLabel } = input;
  const sentences: string[] = [];
  const en = locale === "en";

  if (en) {
    const themePart = theme ? ` around ${theme}` : "";
    sentences.push(
      `${name} brings together ${memberCount} ${pluralize(memberCount, "member", "members")}${themePart}.`,
    );
  } else {
    const themePart = theme ? ` em torno de ${theme}` : "";
    sentences.push(
      `${name} reúne ${memberCount} ${pluralize(memberCount, "membro", "membros")}${themePart}.`,
    );
  }

  if (en) {
    const foundedPart = foundedLabel ? `The community has existed since ${foundedLabel}` : "The community";
    if (chartCount > 0) {
      sentences.push(
        `${foundedPart} and has already published ${chartCount} ${pluralize(chartCount, "collective chart", "collective charts")}.`,
      );
    }
  } else {
    const foundedPart = foundedLabel ? `A comunidade existe desde ${foundedLabel}` : "A comunidade";
    if (chartCount > 0) {
      sentences.push(
        `${foundedPart} e já publicou ${chartCount} ${pluralize(chartCount, "parada coletiva", "paradas coletivas")}.`,
      );
    }
  }

  if (topSong && weekLabel) {
    sentences.push(
      en
        ? `In ${weekLabel}, the members' top song was "${topSong.title}" by ${topSong.artist}.`
        : `Na semana de ${weekLabel}, a música mais votada pelos membros foi "${topSong.title}", de ${topSong.artist}.`,
    );
  }

  return sentences.join(" ");
}
