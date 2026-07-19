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
};

export type SpotifySearchResult = {
  tracks: Song[];
  loading: boolean;
  configured: boolean;
  unavailable: boolean;
};

/**
 * Busca de músicas via backend (/api/spotify/search): catálogo local + Spotify
 * pelo servidor. O browser não fala mais diretamente com api.spotify.com — o
 * servidor tem cache compartilhado de 30 dias e deduplicação de chamadas.
 */
export function useSpotifySearch(
  query: string,
  disabled = false,
  pool?: "crownnote",
): SpotifySearchResult {
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
        const serverRes = await fetch(
          `/api/spotify/search?q=${encodeURIComponent(q)}&limit=12${pool ? `&pool=${pool}` : ""}`,
          { signal: ac.signal, cache: "no-store" },
        );
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

        const songs: Song[] = (serverData.tracks ?? [])
          .filter((t) => !isInstrumentalTitle(t.title))
          .map((t) => ({
            title: t.title,
            artist: t.artist,
            album: t.album,
            imageUrl: t.imageUrl ?? undefined,
            spotifyId: t.spotifyId,
          }));

        setTracks(songs);
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
  }, [query, disabled, pool]);

  return { tracks, loading, configured, unavailable };
}
