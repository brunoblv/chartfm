type SongLike = { artist: string; featArtists?: string[] };

export function formatSongArtist(song: SongLike): string {
  const main = song.artist?.trim() ?? "";
  const explicitFeats = (song.featArtists ?? []).map((name) => name.trim()).filter(Boolean);
  const parsedFeats = explicitFeats.length ? [] : inferFeatsFromLegacyArtist(main);
  const feats = explicitFeats.length ? explicitFeats : parsedFeats;
  if (!feats.length) return main;
  const mainArtist = explicitFeats.length ? main : inferMainFromLegacyArtist(main);
  if (feats.length === 1) return `${mainArtist} feat. ${feats[0]}`;
  return `${mainArtist} feat. ${feats.join(" & ")}`;
}

function inferMainFromLegacyArtist(artist: string): string {
  const commaParts = artist.split(",").map((p) => p.trim()).filter(Boolean);
  if (commaParts.length > 1) return commaParts[0];
  const featMatch = artist.match(/^(.*?)\s+(?:feat\.?|ft\.?)\s+(.+)$/i);
  if (featMatch?.[1]) return featMatch[1].trim();
  return artist;
}

function inferFeatsFromLegacyArtist(artist: string): string[] {
  const featMatch = artist.match(/^(.*?)\s+(?:feat\.?|ft\.?)\s+(.+)$/i);
  if (featMatch?.[2]) {
    return splitFeatNames(featMatch[2]);
  }
  const commaParts = artist.split(",").map((p) => p.trim()).filter(Boolean);
  if (commaParts.length > 1) return commaParts.slice(1);
  return [];
}

function splitFeatNames(raw: string): string[] {
  return raw
    .split(/\s*&\s*|\s+and\s+|\s*,\s*/i)
    .map((n) => n.trim())
    .filter(Boolean);
}
