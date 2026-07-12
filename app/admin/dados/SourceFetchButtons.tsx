"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { RefreshCw } from "lucide-react";

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

const triedChipStyle: CSSProperties = {
  ...chipStyle,
  color: "var(--text-disabled)",
  borderStyle: "dashed",
  opacity: 0.7,
};

type FetchState =
  | { status: "idle" }
  | { status: "loading"; source: Source }
  | { status: "done"; source: Source; found: string[]; applied: string[]; link?: string; skipped?: boolean }
  | { status: "error"; source: Source; message: string }
  | { status: "forcing"; source: Source };

async function callFetchSource(kind: Kind, id: string | number, source: Source, force: boolean) {
  const res = await fetch("/api/admin/edicao-de-dados/fetch-source", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ kind, id, source, force }),
  });
  const data = (await res.json().catch(() => ({}))) as {
    ok?: boolean;
    found?: string[];
    applied?: string[];
    link?: string;
    skipped?: boolean;
    error?: string;
  };
  if (!res.ok || !data.ok) throw new Error(data.error ?? "erro na consulta");
  return data;
}

/**
 * Botões "uma fonte por vez" (Last.fm, Spotify, MusicBrainz, Wikipedia):
 * consultam a fonte para este registro e preenchem só os campos vazios.
 * Fontes já marcadas como "sem resultado" (`notFound`) são puladas sem bater
 * na API — o botão "Forçar tudo" ignora essa marcação nas 4 fontes.
 */
export function SourceFetchButtons({
  kind,
  id,
  notFound = [],
}: {
  kind: Kind;
  id: string | number;
  /** Fontes já consultadas sem resultado para este registro (pulam a API por padrão). */
  notFound?: string[];
}) {
  const [state, setState] = useState<FetchState>({ status: "idle" });
  const [tried, setTried] = useState<Set<string>>(new Set(notFound));
  const [forcingAll, setForcingAll] = useState(false);

  const busy = state.status === "loading" || state.status === "forcing" || forcingAll;

  async function run(source: Source, force = false) {
    if (busy) return;
    setState({ status: "loading", source });
    try {
      const data = await callFetchSource(kind, id, source, force);
      setTried((prev) => {
        const next = new Set(prev);
        if ((data.found?.length ?? 0) > 0) next.delete(source);
        else next.add(source);
        return next;
      });
      setState({
        status: "done",
        source,
        found: data.found ?? [],
        applied: data.applied ?? [],
        link: data.link,
        skipped: data.skipped,
      });
    } catch (err) {
      setState({ status: "error", source, message: err instanceof Error ? err.message : "erro de rede" });
    }
  }

  async function runAllForced() {
    if (busy) return;
    setForcingAll(true);
    try {
      for (const s of SOURCES) {
        setState({ status: "forcing", source: s.key });
        try {
          const data = await callFetchSource(kind, id, s.key, true);
          setTried((prev) => {
            const next = new Set(prev);
            if ((data.found?.length ?? 0) > 0) next.delete(s.key);
            else next.add(s.key);
            return next;
          });
          setState({
            status: "done",
            source: s.key,
            found: data.found ?? [],
            applied: data.applied ?? [],
            link: data.link,
          });
        } catch (err) {
          setState({ status: "error", source: s.key, message: err instanceof Error ? err.message : "erro de rede" });
        }
      }
    } finally {
      setForcingAll(false);
    }
  }

  const sourceLabel = (s: Source) => SOURCES.find((x) => x.key === s)?.label ?? s;

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
        {SOURCES.map((s) => {
          const loading = (state.status === "loading" || state.status === "forcing") && state.source === s.key;
          const wasTried = tried.has(s.key);
          return (
            <button
              key={s.key}
              type="button"
              title={
                wasTried
                  ? `${s.title} — já buscado sem resultado; clique para tentar de novo`
                  : s.title
              }
              onClick={() => run(s.key)}
              disabled={busy}
              style={{
                ...(wasTried ? triedChipStyle : chipStyle),
                ...(loading ? { color: "#FA243C", borderColor: "rgba(250,36,60,0.4)" } : null),
                ...(busy && !loading ? { opacity: 0.5, cursor: "wait" } : null),
              }}
            >
              {loading ? "…" : s.label}
            </button>
          );
        })}
        <button
          type="button"
          title="Consulta as 4 fontes de novo, mesmo as já marcadas como sem resultado (individual)"
          onClick={runAllForced}
          disabled={busy}
          style={{
            ...chipStyle,
            display: "inline-flex",
            alignItems: "center",
            gap: 3,
            color: forcingAll ? "#FA243C" : "var(--text-muted)",
            borderColor: forcingAll ? "rgba(250,36,60,0.4)" : "var(--divider-strong)",
            ...(busy && !forcingAll ? { opacity: 0.5, cursor: "wait" } : null),
          }}
        >
          <RefreshCw size={10} style={forcingAll ? { animation: "spin 1s linear infinite" } : undefined} />
          FORÇAR
        </button>
      </div>

      {state.status === "done" && (
        <div style={{ marginTop: 4, fontSize: 11, lineHeight: 1.5, maxWidth: 260 }}>
          <span style={{ fontWeight: 800, color: "var(--text-muted)" }}>{sourceLabel(state.source)}:</span>{" "}
          {state.skipped ? (
            <span style={{ color: "var(--text-muted)" }}>já buscado, sem resultado (pulado) — use FORÇAR</span>
          ) : state.found.length === 0 ? (
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
