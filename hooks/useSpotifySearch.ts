"use client";

import { useEffect, useState } from "react";
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
};

export type SpotifySearchResult = {
  tracks: Song[];
  loading: boolean;
  configured: boolean;
  unavailable: boolean;
};

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

        const dbSongs: Song[] = (serverData.tracks ?? []).map((t) => ({
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

        try {
          const words = q.split(/\s+/);
          const extraQueries: string[] = [];
          if (words.length === 2) {
            extraQueries.push(`artist:${words[0]} track:${words[1]}`);
            extraQueries.push(`track:${words[0]} artist:${words[1]}`);
          } else if (words.length >= 3) {
            extraQueries.push(`artist:${words[0]} track:${words.slice(1).join(" ")}`);
            extraQueries.push(`artist:${words[words.length - 1]} track:${words.slice(0, -1).join(" ")}`);
          }

          const fetchQuery = (query: string) =>
            fetch(
              `https://api.spotify.com/v1/search?q=${encodeURIComponent(query)}&type=track&limit=12&market=BR`,
              { headers: { Authorization: `Bearer ${accessToken}` }, signal: ac.signal },
            )
              .then((r) => (r.ok ? r.json() : { tracks: { items: [] } }))
              .then((d: { tracks?: { items: SpotifyDirectItem[] } }) => d.tracks?.items ?? [])
              .catch(() => [] as SpotifyDirectItem[]);

          const allResults = await Promise.all([fetchQuery(q), ...extraQueries.map(fetchQuery)]);
          if (ac.signal.aborted) return;

          // Structured queries first so targeted matches (artist:X track:Y) beat broad plain results
          const orderedItems = [...allResults.slice(1).flat(), ...allResults[0]];

          const seen = new Set(dbSongs.map((s) => s.spotifyId).filter((id): id is string => Boolean(id)));
          const merged = [...dbSongs];
          for (const item of orderedItems) {
            if (!item?.id || seen.has(item.id)) continue;
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
    }, 220);
    return () => {
      ac.abort();
      clearTimeout(timer);
    };
  }, [query, disabled]);

  return { tracks, loading, configured, unavailable };
}
