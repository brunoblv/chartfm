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
          const spotRes = await fetch(
            `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=12&market=BR`,
            { headers: { Authorization: `Bearer ${accessToken}` }, signal: ac.signal },
          );
          if (ac.signal.aborted || !spotRes.ok) return;

          const spotData = (await spotRes.json()) as {
            tracks?: { items: SpotifyDirectItem[] };
          };
          if (ac.signal.aborted) return;

          const seen = new Set(dbSongs.map((s) => s.spotifyId).filter((id): id is string => Boolean(id)));
          const merged = [...dbSongs];
          for (const item of spotData.tracks?.items ?? []) {
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
