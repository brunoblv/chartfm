"use client";

import { useEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { adminTdStyle, adminThStyle } from "@/components/admin/admin-styles";
import { AdminPanel } from "@/components/admin/AdminPanel";
import {
  AdminAlbumLinks,
  AdminArtistLinks,
  AdminArtistNameLink,
  AdminSongLinks,
  AdminSongNameLink,
} from "@/components/admin/AdminEntityLinks";
import { isAdminMusicTypeaheadQueryReady } from "@/lib/admin-music-typeahead";
import { chartGenreSlugsForTags, getChartGenreBySlug } from "@/lib/genre-taxonomy";
import { ArtistRefreshImageButton } from "../artists/ArtistRefreshImageButton";
import { InlineField, InlineTags } from "./InlineEdit";
import { SourceFetchButtons } from "./SourceFetchButtons";
import { YouTubeClipFetchButton } from "./YouTubeClipFetchButton";

type Kind = "music" | "albums" | "artists";

type SongRow = {
  id: string;
  title: string;
  artist: string;
  album: string | null;
  spotifyId: string | null;
  genres: string[];
  genreSource: string | null;
  sourcesNotFound: string[];
  artistGenres: string[];
};

type AlbumRow = {
  id: number;
  title: string;
  spotifyId: string | null;
  sourcesNotFound: string[];
  artist: { id: number; name: string; spotifyId: string | null; genres: string[] };
  artistGenres: string[];
  songs: { id: string; title: string; artist: string }[];
};

type ArtistRow = {
  id: number;
  name: string;
  exhibitionName: string | null;
  spotifyId: string | null;
  imageUrl: string | null;
  genres: string[];
  sourcesNotFound: string[];
};

const searchInputStyle: CSSProperties = {
  width: "100%",
  maxWidth: 520,
  padding: "10px 12px",
  borderRadius: 10,
  border: "1px solid var(--divider-strong)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: 14,
  boxSizing: "border-box",
};

const mutedSmall: CSSProperties = { color: "var(--text-muted)", fontSize: 12 };

function genreBadgeStyle(matched: boolean): CSSProperties {
  return {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 8px",
    borderRadius: 999,
    fontSize: 11,
    fontWeight: 700,
    lineHeight: 1.6,
    background: matched ? "rgba(250,36,60,0.10)" : "var(--fill-inset)",
    color: matched ? "#C41E3A" : "var(--text-muted)",
    border: matched ? "1px solid rgba(250,36,60,0.25)" : "1px solid var(--divider)",
  };
}

/** Mostra as tags; destaca as que mapeiam para uma categoria de parada e qual é. */
function GenreBadges({ tags }: { tags: string[] }) {
  if (!tags || tags.length === 0) return <span style={mutedSmall}>—</span>;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
      {tags.map((tag, i) => {
        const cats = chartGenreSlugsForTags([tag])
          .map((slug) => getChartGenreBySlug(slug)?.name)
          .filter((n): n is string => Boolean(n));
        const matched = cats.length > 0;
        return (
          <span
            key={`${tag}-${i}`}
            title={matched ? `Categoria: ${cats.join(", ")}` : "Não cai em nenhuma categoria de parada"}
            style={genreBadgeStyle(matched)}
          >
            {tag}
            {matched && <span style={{ marginLeft: 4, fontWeight: 800 }}>→ {cats.join(", ")}</span>}
          </span>
        );
      })}
    </div>
  );
}

function placeholderFor(kind: Kind): string {
  if (kind === "music") return "Buscar por música, artista ou álbum";
  if (kind === "albums") return "Buscar álbum ou artista";
  return "Buscar artista por nome ou romanização";
}

export function DataSearchClient({
  kind,
  initialQuery,
  initialNoSpotify = false,
}: {
  kind: Kind;
  initialQuery: string;
  initialNoSpotify?: boolean;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [noSpotify, setNoSpotify] = useState(kind === "music" && initialNoSpotify);
  const [items, setItems] = useState<unknown[]>([]);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filterActive = kind === "music" && noSpotify;

  useEffect(() => {
    const q = query.trim();

    // mantém o ?q / ?semSpotify na URL para refresh/compartilhamento
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (q) url.searchParams.set("q", q);
      else url.searchParams.delete("q");
      if (filterActive) url.searchParams.set("semSpotify", "1");
      else url.searchParams.delete("semSpotify");
      window.history.replaceState(null, "", url.toString());
    }

    // com o filtro "sem Spotify ID" ligado, busca mesmo sem texto digitado
    if (!isAdminMusicTypeaheadQueryReady(q) && !filterActive) {
      setItems([]);
      setHasSearched(false);
      setLoading(false);
      return;
    }

    const ctrl = new AbortController();
    if (debounceRef.current) clearTimeout(debounceRef.current);
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/admin/edicao-de-dados/search?kind=${kind}&q=${encodeURIComponent(q)}${filterActive ? "&noSpotify=1" : ""}`,
          { signal: ctrl.signal, cache: "no-store" },
        );
        if (!res.ok) {
          setItems([]);
        } else {
          const data = (await res.json()) as { items?: unknown[] };
          setItems(data.items ?? []);
        }
        setHasSearched(true);
      } catch {
        // request abortado/erro de rede — ignora
      } finally {
        setLoading(false);
      }
    }, 200);

    return () => {
      ctrl.abort();
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [query, kind, filterActive, refreshKey]);

  const ready = isAdminMusicTypeaheadQueryReady(query.trim()) || filterActive;

  return (
    <>
      <div style={{ marginBottom: 12 }}>
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={placeholderFor(kind)}
          style={searchInputStyle}
        />
        {loading && <span style={{ ...mutedSmall, marginLeft: 10 }}>Buscando…</span>}
        {kind === "music" && (
          <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", alignItems: "center", gap: 12 }}>
            <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text)", cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={noSpotify}
                onChange={(e) => setNoSpotify(e.target.checked)}
              />
              Somente sem Spotify ID
            </label>
            {filterActive && (
              <BatchSpotifySearch
                rows={(items as SongRow[]).filter((s) => !s.spotifyId)}
                onDone={() => setRefreshKey((k) => k + 1)}
              />
            )}
          </div>
        )}
      </div>

      <AdminPanel maxWidth={kind === "music" ? 1180 : 1040}>
        {kind === "music" && <MusicTable rows={items as SongRow[]} />}
        {kind === "albums" && <AlbumTable rows={items as AlbumRow[]} />}
        {kind === "artists" && <ArtistTable rows={items as ArtistRow[]} />}

        {!ready && (
          <div style={{ padding: 14, color: "var(--text-muted)" }}>
            Digite no campo acima para buscar.
          </div>
        )}
        {ready && hasSearched && !loading && items.length === 0 && (
          <div style={{ padding: 14, color: "var(--text-muted)" }}>Nenhum resultado encontrado.</div>
        )}
      </AdminPanel>
    </>
  );
}

/**
 * Busca no Spotify, uma a uma, todas as músicas listadas sem Spotify ID.
 * Usa o mesmo endpoint do botão SPT por linha (preenche só campos vazios);
 * músicas já marcadas como "sem resultado" no Spotify são puladas pelo
 * servidor sem bater na API. Chamadas sequenciais com pausa para respeitar
 * o rate limit do Spotify.
 */
function BatchSpotifySearch({ rows, onDone }: { rows: SongRow[]; onDone: () => void }) {
  const [running, setRunning] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [summary, setSummary] = useState<string | null>(null);

  async function run() {
    if (running || rows.length === 0) return;
    setRunning(true);
    setSummary(null);
    let applied = 0;
    let skipped = 0;
    let notFound = 0;
    let errors = 0;
    for (let i = 0; i < rows.length; i++) {
      setProgress({ done: i, total: rows.length });
      try {
        const res = await fetch("/api/admin/edicao-de-dados/fetch-source", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind: "music", id: rows[i].id, source: "spotify", force: false }),
        });
        const data = (await res.json().catch(() => ({}))) as {
          ok?: boolean;
          applied?: string[];
          found?: string[];
          skipped?: boolean;
        };
        if (!res.ok || !data.ok) errors++;
        else if (data.skipped) skipped++;
        else if ((data.applied?.length ?? 0) > 0) applied++;
        else notFound++;
      } catch {
        errors++;
      }
      if (i < rows.length - 1) await new Promise((r) => setTimeout(r, 400));
    }
    setProgress(null);
    setRunning(false);
    const parts = [`${applied} preenchida${applied === 1 ? "" : "s"}`];
    if (notFound > 0) parts.push(`${notFound} sem resultado`);
    if (skipped > 0) parts.push(`${skipped} pulada${skipped === 1 ? "" : "s"} (já sem resultado — use FORÇAR na linha)`);
    if (errors > 0) parts.push(`${errors} com erro`);
    setSummary(parts.join(" · "));
    onDone();
  }

  return (
    <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
      <button
        type="button"
        onClick={run}
        disabled={running || rows.length === 0}
        title="Consulta o Spotify para cada música listada sem ID e preenche o que encontrar"
        style={{
          padding: "5px 12px",
          borderRadius: 999,
          border: "1px solid rgba(250,36,60,0.35)",
          background: running ? "var(--fill-inset)" : "rgba(250,36,60,0.08)",
          color: "#C41E3A",
          fontSize: 12,
          fontWeight: 700,
          cursor: running || rows.length === 0 ? "default" : "pointer",
          opacity: rows.length === 0 ? 0.5 : 1,
        }}
      >
        {running && progress
          ? `Buscando no Spotify… ${progress.done + 1}/${progress.total}`
          : `Buscar no Spotify (${rows.length} listada${rows.length === 1 ? "" : "s"})`}
      </button>
      {summary && <span style={mutedSmall}>{summary}</span>}
    </span>
  );
}

function MusicTable({ rows }: { rows: SongRow[] }) {
  if (rows.length === 0) return null;
  return (
    <table style={{ width: "100%", minWidth: 900, borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ background: "var(--fill-inset)" }}>
          <th style={adminThStyle}>Música</th>
          <th style={adminThStyle}>Artista</th>
          <th style={adminThStyle}>Álbum</th>
          <th style={adminThStyle}>Gêneros (música)</th>
          <th style={adminThStyle}>Gêneros (artista)</th>
          <th style={adminThStyle}>Spotify ID</th>
          <th style={adminThStyle}>Ações</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((s) => (
          <tr key={s.id}>
            <td style={{ ...adminTdStyle, verticalAlign: "top" }}>
              <InlineField kind="music" id={s.id} field="title" value={s.title} required bold />
            </td>
            <td style={{ ...adminTdStyle, verticalAlign: "top" }}>{s.artist}</td>
            <td style={{ ...adminTdStyle, verticalAlign: "top" }}>{s.album?.trim() ? s.album : "—"}</td>
            <td style={{ ...adminTdStyle, verticalAlign: "top", maxWidth: 280 }}>
              <InlineTags
                kind="music"
                id={s.id}
                field="genres"
                tags={s.genres}
                render={(tags) => <GenreBadges tags={tags} />}
              />
              {s.genreSource && <div style={{ ...mutedSmall, marginTop: 4 }}>fonte: {s.genreSource}</div>}
            </td>
            <td style={{ ...adminTdStyle, verticalAlign: "top", maxWidth: 280 }}>
              <GenreBadges tags={s.artistGenres} />
            </td>
            <td style={{ ...adminTdStyle, verticalAlign: "top", fontFamily: "monospace", fontSize: 12 }}>
              <InlineField kind="music" id={s.id} field="spotifyId" value={s.spotifyId} mono />
            </td>
            <td style={{ ...adminTdStyle, verticalAlign: "top" }}>
              <AdminSongLinks song={s} />
              <SourceFetchButtons kind="music" id={s.id} notFound={s.sourcesNotFound} />
              <YouTubeClipFetchButton songId={s.id} title={s.title} artist={s.artist} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function AlbumTable({ rows }: { rows: AlbumRow[] }) {
  if (rows.length === 0) return null;
  return (
    <table style={{ width: "100%", minWidth: 820, borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ background: "var(--fill-inset)" }}>
          <th style={adminThStyle}>Álbum</th>
          <th style={adminThStyle}>Artista</th>
          <th style={adminThStyle}>Gêneros (do artista)</th>
          <th style={adminThStyle}>Músicas</th>
          <th style={adminThStyle}>Ações</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((a) => (
          <tr key={a.id}>
            <td style={{ ...adminTdStyle, verticalAlign: "top" }}>
              <InlineField kind="albums" id={a.id} field="title" value={a.title} required bold />
            </td>
            <td style={{ ...adminTdStyle, verticalAlign: "top" }}>
              <AdminArtistNameLink artist={a.artist} />{" "}
              <span style={mutedSmall}>({a.artist.id})</span>
            </td>
            <td style={{ ...adminTdStyle, verticalAlign: "top", maxWidth: 300 }}>
              <GenreBadges tags={a.artistGenres} />
            </td>
            <td style={{ ...adminTdStyle, verticalAlign: "top", maxWidth: 320 }}>
              {a.songs.length === 0 ? (
                <span style={mutedSmall}>Nenhuma</span>
              ) : (
                <ul style={{ margin: 0, padding: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 2 }}>
                  {a.songs.map((s) => (
                    <li key={s.id} style={{ fontSize: 12, color: "var(--text)" }}>
                      <AdminSongNameLink song={{ id: s.id, title: s.title, artist: s.artist }} />
                    </li>
                  ))}
                </ul>
              )}
            </td>
            <td style={{ ...adminTdStyle, verticalAlign: "top" }}>
              <AdminAlbumLinks album={a} />
              <SourceFetchButtons kind="albums" id={a.id} notFound={a.sourcesNotFound} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function ArtistTable({ rows }: { rows: ArtistRow[] }) {
  if (rows.length === 0) return null;
  return (
    <table style={{ width: "100%", minWidth: 820, borderCollapse: "collapse" }}>
      <thead>
        <tr style={{ background: "var(--fill-inset)" }}>
          <th style={adminThStyle}>Artista</th>
          <th style={adminThStyle}>Romanização</th>
          <th style={adminThStyle}>Gêneros</th>
          <th style={adminThStyle}>Spotify ID</th>
          <th style={adminThStyle}>Ações</th>
        </tr>
      </thead>
      <tbody>
        {rows.map((a) => (
          <tr key={a.id}>
            <td style={{ ...adminTdStyle, verticalAlign: "top" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                {a.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={a.imageUrl}
                    alt=""
                    width={28}
                    height={28}
                    style={{ borderRadius: 6, objectFit: "cover", flexShrink: 0 }}
                  />
                ) : (
                  <div
                    style={{ width: 28, height: 28, borderRadius: 6, border: "1.5px dashed var(--text-disabled)", flexShrink: 0 }}
                  />
                )}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <InlineField kind="artists" id={a.id} field="name" value={a.name} required bold />
                </div>
              </div>
            </td>
            <td style={{ ...adminTdStyle, verticalAlign: "top", color: "var(--text-subtle)" }}>
              <InlineField kind="artists" id={a.id} field="exhibitionName" value={a.exhibitionName} placeholder="—" />
            </td>
            <td style={{ ...adminTdStyle, verticalAlign: "top", maxWidth: 360 }}>
              <InlineTags
                kind="artists"
                id={a.id}
                field="genres"
                tags={a.genres}
                render={(tags) => <GenreBadges tags={tags} />}
              />
            </td>
            <td style={{ ...adminTdStyle, verticalAlign: "top", fontFamily: "monospace", fontSize: 12, color: "var(--text-muted)" }}>
              {a.spotifyId}
            </td>
            <td style={{ ...adminTdStyle, verticalAlign: "top" }}>
              <AdminArtistLinks artist={a} />
              <ArtistRefreshImageButton artistId={a.id} />
              <SourceFetchButtons kind="artists" id={a.id} notFound={a.sourcesNotFound} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
