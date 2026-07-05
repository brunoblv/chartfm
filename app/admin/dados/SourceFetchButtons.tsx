"use client";

import { useState } from "react";
import type { CSSProperties } from "react";

type Kind = "music" | "albums" | "artists";
type Source = "lastfm" | "spotify" | "musicbrainz" | "wikipedia";

const SOURCES: { key: Source; label: string; title: string }[] = [
  { key: "lastfm", label: "LFM", title: "Buscar no Last.fm (tags/gêneros)" },
  { key: "spotify", label: "SPT", title: "Buscar no Spotify (metadados, capa, links)" },
  { key: "musicbrainz", label: "MB", title: "Buscar no MusicBrainz (MBID, datas de single/clipe, tags)" },
  { key: "wikipedia", label: "WIKI", title: "Buscar na Wikipedia (datas de lançamento, bio) — datas divergentes são corrigidas: vale a da Wikipedia" },
];

const chipStyle: CSSProperties = {
  padding: "3px 8px",
  borderRadius: 999,
  border: "1px solid var(--divider-strong)",
  background: "var(--surface)",
  color: "var(--text-muted)",
  fontSize: 10,
  fontWeight: 800,
  letterSpacing: "0.04em",
  cursor: "pointer",
  lineHeight: 1.4,
};

type FetchState =
  | { status: "idle" }
  | { status: "loading"; source: Source }
  | { status: "done"; source: Source; found: string[]; applied: string[]; link?: string }
  | { status: "error"; source: Source; message: string };

/**
 * Botões "uma fonte por vez" (Last.fm, Spotify, MusicBrainz, Wikipedia):
 * consultam a fonte para este registro e preenchem só os campos vazios.
 */
export function SourceFetchButtons({ kind, id }: { kind: Kind; id: string | number }) {
  const [state, setState] = useState<FetchState>({ status: "idle" });

  async function run(source: Source) {
    if (state.status === "loading") return;
    setState({ status: "loading", source });
    try {
      const res = await fetch("/api/admin/edicao-de-dados/fetch-source", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind, id, source }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        found?: string[];
        applied?: string[];
        link?: string;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setState({ status: "error", source, message: data.error ?? "erro na consulta" });
        return;
      }
      setState({
        status: "done",
        source,
        found: data.found ?? [],
        applied: data.applied ?? [],
        link: data.link,
      });
    } catch {
      setState({ status: "error", source, message: "erro de rede" });
    }
  }

  const sourceLabel = (s: Source) => SOURCES.find((x) => x.key === s)?.label ?? s;

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
        {SOURCES.map((s) => {
          const loading = state.status === "loading" && state.source === s.key;
          return (
            <button
              key={s.key}
              type="button"
              title={s.title}
              onClick={() => run(s.key)}
              disabled={state.status === "loading"}
              style={{
                ...chipStyle,
                ...(loading ? { color: "#FA243C", borderColor: "rgba(250,36,60,0.4)" } : null),
                ...(state.status === "loading" && !loading ? { opacity: 0.5, cursor: "wait" } : null),
              }}
            >
              {loading ? "…" : s.label}
            </button>
          );
        })}
      </div>

      {state.status === "done" && (
        <div style={{ marginTop: 4, fontSize: 11, lineHeight: 1.5, maxWidth: 260 }}>
          <span style={{ fontWeight: 800, color: "var(--text-muted)" }}>{sourceLabel(state.source)}:</span>{" "}
          {state.found.length === 0 ? (
            <span style={{ color: "var(--text-muted)" }}>nada encontrado</span>
          ) : (
            <>
              <span style={{ color: "var(--text)" }}>{state.found.join(" · ")}</span>
              {" — "}
              {state.applied.length > 0 ? (
                <span style={{ color: "#2D7A32", fontWeight: 700 }}>
                  aplicado: {state.applied.join(", ")}
                </span>
              ) : (
                <span style={{ color: "var(--text-muted)" }}>nada a preencher</span>
              )}
            </>
          )}
          {state.link && (
            <>
              {" "}
              <a href={state.link} target="_blank" rel="noreferrer" style={{ color: "#FA243C", fontWeight: 700 }}>
                fonte ↗
              </a>
            </>
          )}
        </div>
      )}
      {state.status === "error" && (
        <div style={{ marginTop: 4, fontSize: 11, color: "#C41E3A", maxWidth: 260 }}>
          {sourceLabel(state.source)}: {state.message}
        </div>
      )}
    </div>
  );
}
