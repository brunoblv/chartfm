/** Chave estável para mapas de estatísticas (ex.: #1s) — alinhada ao mapeamento do chart no cliente. */
export function buildSongStatsKey(song: {
  title: string;
  artist: string;
  exhibitionName?: string | null;
  artistRef?: { name?: string | null } | null;
}): string {
  const title = song.exhibitionName?.trim() || song.title;
  const artist = song.artistRef?.name?.trim() || song.artist;
  return `${title}\0${artist}`;
}

/** Lookup no cliente após `mapPrismaChartRowToChart` (title/artist já normalizados). */
export function buildSongStatsKeyFromMapped(song: { title: string; artist: string }): string {
  return `${song.title}\0${song.artist}`;
}

export function lookupNumberOnes(
  map: Record<string, number> | undefined,
  song: { id?: string | null; title: string; artist: string },
): number {
  if (!map) return 0;
  if (song.id && map[song.id] != null) return map[song.id];
  return map[buildSongStatsKeyFromMapped(song)] ?? 0;
}
