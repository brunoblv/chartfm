"use client";

import { useState } from "react";
import type { CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import type { SourceConflict } from "@/lib/edicao-de-dados-source-fetch";
import { SourceConflictMergeModal } from "./SourceConflictMergeModal";

type Kind = "music" | "albums" | "artists";
type Source = "lastfm" | "spotify" | "musicbrainz" | "wikipedia" | "bugs" | "deezer";

const SOURCES: { key: Source; label: string; title: string; kinds: Kind[] }[] = [
  { key: "lastfm", label: "LFM", title: "Buscar no Last.fm (tags/gêneros)", kinds: ["music", "albums", "artists"] },
  { key: "spotify", label: "SPT", title: "Buscar no Spotify (metadados, capa, links)", kinds: ["music", "albums", "artists"] },
  { key: "musicbrainz", label: "MB", title: "Buscar no MusicBrainz (MBID, datas de single/clipe, tags)", kinds: ["music", "albums", "artists"] },
  { key: "deezer", label: "DZR", title: "Buscar no Deezer (capa, data de lançamento, tipo, faixas, selo, imagem de artista) — match por ISRC quando disponível", kinds: ["music", "albums", "artists"] },
  { key: "wikipedia", label: "WIKI", title: "Buscar na Wikipedia (datas de lançamento, bio) — datas divergentes são corrigidas: vale a da Wikipedia", kinds: ["music", "albums", "artists"] },
  { key: "bugs", label: "BUGS", title: "Buscar no Bugs (music.bugs.co.kr) — capa, data de single, data de álbum e data de clipe; boa cobertura de kpop", kinds: ["music", "albums"] },
];

const chipStyle: CSSProperties = {
  padding: "3px 8px",
  borderRadius: 999,
  borderWidth: 1,
  borderStyle: "solid",
  borderColor: "var(--divider-strong)",
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
  | {
      status: "done";
      source: Source;
      found: string[];
      applied: string[];
      link?: string;
      skipped?: boolean;
      conflict?: SourceConflict;
    }
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
    conflict?: SourceConflict;
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
  inline = false,
  onApplied,
}: {
  kind: Kind;
  id: string | number;
  /** Fontes já consultadas sem resultado para este registro (pulam a API por padrão). */
  notFound?: string[];
  /** Sem margem superior — para ficar na mesma linha de Ver/Editar. */
  inline?: boolean;
  /** Chamado quando uma busca aplica pelo menos um campo novo. */
  onApplied?: () => void;
}) {
  const router = useRouter();
  const [state, setState] = useState<FetchState>({ status: "idle" });
  const [tried, setTried] = useState<Set<string>>(new Set(notFound));
  const [forcingAll, setForcingAll] = useState(false);
  const [mergeConflict, setMergeConflict] = useState<SourceConflict | null>(null);

  const sourcesForKind = SOURCES.filter((s) => s.kinds.includes(kind));
  const busy = state.status === "loading" || state.status === "forcing" || forcingAll;

  function applyDoneState(
    source: Source,
    data: {
      found?: string[];
      applied?: string[];
      link?: string;
      skipped?: boolean;
      conflict?: SourceConflict;
    },
  ) {
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
      conflict: data.conflict,
    });
    if (data.conflict) setMergeConflict(data.conflict);
    if ((data.applied?.length ?? 0) > 0) {
      router.refresh();
      onApplied?.();
    }
  }

  async function run(source: Source, force = false) {
    if (busy) return;
    setState({ status: "loading", source });
    try {
      const data = await callFetchSource(kind, id, source, force);
      applyDoneState(source, data);
    } catch (err) {
      setState({ status: "error", source, message: err instanceof Error ? err.message : "erro de rede" });
    }
  }

  async function runAllForced() {
    if (busy) return;
    setForcingAll(true);
    try {
      for (const s of sourcesForKind) {
        setState({ status: "forcing", source: s.key });
        try {
          const data = await callFetchSource(kind, id, s.key, true);
          applyDoneState(s.key, data);
          if (data.conflict) break;
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
    <div style={inline ? { display: "contents" } : { marginTop: 6 }}>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 4, alignItems: "center" }}>
        {sourcesForKind.map((s) => {
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
        <div style={{ marginTop: 4, fontSize: 11, lineHeight: 1.5, maxWidth: 280 }}>
          <span style={{ fontWeight: 800, color: "var(--text-muted)" }}>{sourceLabel(state.source)}:</span>{" "}
          {state.skipped ? (
            <span style={{ color: "var(--text-muted)" }}>já buscado, sem resultado (pulado) — use FORÇAR</span>
          ) : state.conflict ? (
            <>
              <span style={{ color: "#B45309", fontWeight: 700 }}>{state.conflict.label}</span>
              {" — "}
              <button
                type="button"
                onClick={() => setMergeConflict(state.conflict!)}
                style={{
                  border: "none",
                  background: "none",
                  padding: 0,
                  color: "#FA243C",
                  fontWeight: 800,
                  fontSize: 11,
                  cursor: "pointer",
                  textDecoration: "underline",
                }}
              >
                abrir merge
              </button>
            </>
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
          {state.link && !state.conflict && (
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

      {mergeConflict && (
        <SourceConflictMergeModal
          conflict={mergeConflict}
          onClose={() => setMergeConflict(null)}
          onMerged={() => {
            setState({ status: "idle" });
            setMergeConflict(null);
            router.refresh();
          }}
        />
      )}
    </div>
  );
}
