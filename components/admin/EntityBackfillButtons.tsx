"use client";

import { useRouter } from "next/navigation";
import { SourceFetchButtons } from "@/app/admin/dados/SourceFetchButtons";

/**
 * Botões de backfill (Last.fm/Spotify/MusicBrainz/Wikipedia/Bugs) para uso
 * nas páginas públicas de artista/álbum/música, visíveis só para admins.
 * Dá refresh na página (dados vêm de Server Component) após aplicar algo.
 */
export function EntityBackfillButtons({
  kind,
  id,
  notFound = [],
}: {
  kind: "music" | "albums" | "artists";
  id: string | number;
  notFound?: string[];
}) {
  const router = useRouter();
  return (
    <SourceFetchButtons
      kind={kind}
      id={id}
      notFound={notFound}
      inline
      onApplied={() => router.refresh()}
    />
  );
}
