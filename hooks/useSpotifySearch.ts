"use client";

import { useEffect, useState } from "react";
import { isInstrumentalTitle } from "@/lib/is-instrumental-title";
import type { Song } from "@/lib/types";

type SpotifyApiTrack = {
  spotifyId: string;
  title: string;
  artist: string;
  album: string;
  imageUrl: string | null;
};

type SpotifySearchResponse = {
  tracks?: SpotifyApiTrack[];
  configured?: boolean;
  accessToken?: string | null;
};

type SpotifyDirectItem = {
  id: string;
  name: string;
  artists: Array<{ name: string }>;
  album: { name: string; images: Array<{ url: string }> };
  popularity?: number;
};

export type SpotifySearchResult = {
  tracks: Song[];
  loading: boolean;
  configured: boolean;
  unavailable: boolean;
};

// Cross-field relevance: highest score when query words match across both title and artist
function scoreMatch(item: SpotifyDirectItem, words: string[]): number {
  if (words.length < 2) return 0;
  const title = item.name.toLowerCase();
  const artist = (item.artists?.map((a) => a.name).join(" ") ?? "").toLowerCase();
  let titleHits = 0;
  let artistHits = 0;
  for (const w of words) {
    if (title.includes(w)) titleHits++;
    if (artist.includes(w)) artistHits++;
  }
  // Cross-field match (some words in title, some in artist) is the strongest signal
  if (titleHits > 0 && artistHits > 0) return 1000 + titleHits * 10 + artistHits * 10;
  return titleHits * 5 + artistHits * 5;
}

// Cooldown compartilhado entre todas as instâncias do hook: um 429 desliga a Fase 2
// (busca direta no browser) por um tempo, pra não realimentar o rate limit do Spotify.
let phase2CooldownUntil = 0;
const PHASE2_COOLDOWN_MS = 5 * 60_000;

export function useSpotifySearch(query: string, disabled = false): SpotifySearchResult {
  const [tracks, setTracks] = useState<Song[]>([]);
  const [loading, setLoading] = useState(false);
  const [configured, setConfigured] = useState(true);
  const [unavailable, setUnavailable] = useState(false);

  useEffect(() => {
    if (disabled) {
      setTracks([]);
      setLoading(false);
      setConfigured(false);
      return;
    }
    const q = query.trim();
    if (q.length < 1) {
      setTracks([]);
      setLoading(false);
      setConfigured(true);
      return;
    }
    const ac = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      setUnavailable(false);
      try {
        // Fase 1: catálogo local + access token (servidor, rápido)
        const serverRes = await fetch(`/api/spotify/search?q=${encodeURIComponent(q)}&limit=12`, {
          signal: ac.signal,
          cache: "no-store",
        });
        if (ac.signal.aborted) return;
        if (!serverRes.ok) {
          try {
            const errData = (await serverRes.json()) as { configured?: boolean };
            if (!ac.signal.aborted && errData.configured === false) {
              setConfigured(false);
            } else if (!ac.signal.aborted) {
              setUnavailable(true);
            }
          } catch {
            if (!ac.signal.aborted) setUnavailable(true);
          }
          setTracks([]);
          return;
        }

        const serverData = (await serverRes.json()) as SpotifySearchResponse;
        if (ac.signal.aborted) return;

        setConfigured(serverData.configured !== false);

        const dbSongs: Song[] = (serverData.tracks ?? [])
          .filter((t) => !isInstrumentalTitle(t.title))
          .map((t) => ({
          title: t.title,
          artist: t.artist,
          album: t.album,
          imageUrl: t.imageUrl ?? undefined,
          spotifyId: t.spotifyId,
        }));

        setTracks(dbSongs);
        setLoading(false);

        // Fase 2: busca direto no Spotify pelo browser (evita timeout do servidor)
        const accessToken = serverData.accessToken;
        if (!accessToken || serverData.configured === false) return;
        if (Date.now() < phase2CooldownUntil) return;

        try {
          const words = q.toLowerCase().split(/\s+/);
          const extraQueries: string[] = [];
          if (words.length === 2) {
            extraQueries.push(`artist:${words[0]} track:${words[1]}`);
          } else if (words.length >= 3) {
            extraQueries.push(`artist:${words[0]} track:${words.slice(1).join(" ")}`);
          }

          const fetchQuery = (qStr: string) =>
            fetch(
              `https://api.spotify.com/v1/search?q=${encodeURIComponent(qStr)}&type=track&limit=20&market=BR`,
              { headers: { Authorization: `Bearer ${accessToken}` }, signal: ac.signal },
            )
              .then((r) => {
                if (r.status === 429) phase2CooldownUntil = Date.now() + PHASE2_COOLDOWN_MS;
                return r.ok ? r.json() : { tracks: { items: [] } };
              })
              .then((d: { tracks?: { items: SpotifyDirectItem[] } }) => d.tracks?.items ?? [])
              .catch(() => [] as SpotifyDirectItem[]);

          const allResults = await Promise.all([fetchQuery(q), ...extraQueries.map(fetchQuery)]);
          if (ac.signal.aborted) return;

          // Deduplicate across all queries
          const seenPhase2 = new Set<string>();
          const candidates: SpotifyDirectItem[] = [];
          for (const item of allResults.flat()) {
            if (!item?.id || seenPhase2.has(item.id)) continue;
            seenPhase2.add(item.id);
            candidates.push(item);
          }

          // Sort by cross-field relevance: items where words match both title AND artist rank highest
          candidates.sort((a, b) => scoreMatch(b, words) - scoreMatch(a, words));

          const seen = new Set(dbSongs.map((s) => s.spotifyId).filter((id): id is string => Boolean(id)));
          const merged = [...dbSongs];
          for (const item of candidates) {
            if (seen.has(item.id) || isInstrumentalTitle(item.name)) continue;
            seen.add(item.id);
            merged.push({
              title: item.name,
              artist: item.artists?.map((a) => a.name).join(", ") ?? "",
              album: item.album?.name ?? "",
              imageUrl: item.album?.images?.[0]?.url ?? undefined,
              spotifyId: item.id,
            });
            if (merged.length >= 12) break;
          }
          if (!ac.signal.aborted) setTracks(merged);
        } catch {
          // Fase 2 silenciosa — resultados do catálogo local já visíveis
        }
      } catch {
        if (ac.signal.aborted) return;
        setUnavailable(true);
        setTracks([]);
      } finally {
        if (!ac.signal.aborted) setLoading(false);
      }
    }, 350);
    return () => {
      ac.abort();
      clearTimeout(timer);
    };
  }, [query, disabled]);

  return { tracks, loading, configured, unavailable };
}
