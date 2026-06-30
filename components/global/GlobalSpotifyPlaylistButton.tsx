"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useSession } from "next-auth/react";
import { Play } from "lucide-react";
import { canUseSpotifyFeatures } from "@/lib/mytrl-access";
import { useTranslations } from "@/hooks/useTranslations";
import type { GlobalPlaylistKind, GlobalPlaylistPeriod } from "@/lib/global-playlist-tracks";

type Props = {
  kind: GlobalPlaylistKind;
  weekIndex: number;
  genreSlug?: string;
  period?: GlobalPlaylistPeriod;
  returnPath: string;
};

export function GlobalSpotifyPlaylistButton({
  kind,
  weekIndex,
  genreSlug,
  period = "weekly",
  returnPath,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { data: session } = useSession();
  const { t } = useTranslations();
  const canUseSpotify = canUseSpotifyFeatures(session?.user?.handle);
  const [spotifyConnected, setSpotifyConnected] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!session?.user?.id || !canUseSpotify) {
      setSpotifyConnected(false);
      return;
    }
    fetch("/api/user/profile", { cache: "no-store" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { spotifyConnected?: boolean } | null) => {
        setSpotifyConnected(data?.spotifyConnected ?? false);
      })
      .catch(() => setSpotifyConnected(false));
  }, [session?.user?.id, canUseSpotify]);

  useEffect(() => {
    if (!canUseSpotify) return;
    const status = searchParams?.get("spotify");
    if (status === "connected") {
      setSpotifyConnected(true);
      setMessage(t("global.spotifyConnectedHint"));
      const url = new URL(returnPath, window.location.origin);
      url.searchParams.delete("spotify");
      url.searchParams.delete("spotify_reason");
      window.history.replaceState({}, "", `${url.pathname}${url.search}`);
    }
  }, [searchParams, canUseSpotify, returnPath, t]);

  if (!canUseSpotify) return null;

  async function exportToSpotify() {
    if (exporting) return;

    if (!session?.user?.id) {
      router.push(`/login?callbackUrl=${encodeURIComponent(returnPath)}`);
      return;
    }

    if (!spotifyConnected) {
      window.location.href = `/api/spotify/connect?from=${encodeURIComponent(returnPath)}`;
      return;
    }

    setExporting(true);
    setMessage(null);
    try {
      const res = await fetch("/api/spotify/playlist-from-global", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, weekIndex, genreSlug, period }),
      });
      const data = (await res.json()) as {
        playlistUrl?: string;
        trackCount?: number;
        skippedCount?: number;
        error?: string;
        needsReconnect?: boolean;
      };

      if (!res.ok) {
        if (data.needsReconnect) setSpotifyConnected(false);
        setMessage(data.error ?? t("global.spotifyExportError"));
        return;
      }

      const skipped =
        typeof data.skippedCount === "number" && data.skippedCount > 0
          ? ` (${t("global.spotifySkipped", { count: data.skippedCount })})`
          : "";
      setMessage(t("global.spotifyExportSuccess", { count: data.trackCount ?? 0 }) + skipped);
      if (data.playlistUrl) window.open(data.playlistUrl, "_blank", "noopener,noreferrer");
    } catch {
      setMessage(t("global.spotifyExportConnectionError"));
    } finally {
      setExporting(false);
    }
  }

  const label = exporting
    ? t("global.spotifyCreating")
    : spotifyConnected
      ? t("global.spotifySave")
      : t("global.spotifyConnect");

  return (
    <div>
      <button
        type="button"
        onClick={exportToSpotify}
        disabled={exporting}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 8,
          background: "#1DB954",
          color: "white",
          border: "none",
          padding: "10px 20px",
          borderRadius: 100,
          fontSize: 14,
          fontWeight: 700,
          boxShadow: "0 2px 8px rgba(30,215,96,0.35)",
          cursor: exporting ? "not-allowed" : "pointer",
          opacity: exporting ? 0.7 : 1,
        }}
      >
        <Play size={16} fill="white" />
        {label}
      </button>
      {message && (
        <p style={{ margin: "10px 0 0", fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
          {message}
        </p>
      )}
    </div>
  );
}
