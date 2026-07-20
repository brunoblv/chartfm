"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Layers, CheckCircle2, AlertCircle, Loader2, X } from "lucide-react";

type Kind = "music" | "albums" | "artists";
type Source = "lastfm" | "spotify" | "musicbrainz" | "wikipedia" | "bugs" | "deezer" | "all";

const SOURCES: { key: Source; label: string; title: string; kinds: Kind[] }[] = [
  { key: "all", label: "Todas as APIs", title: "Roda Spotify, MusicBrainz, Last.fm, Wikipedia e Deezer, nessa ordem, para cada item (Bugs fica de fora — só cobre bem música asiática, use o filtro dedicado)", kinds: ["music", "albums", "artists"] },
  { key: "spotify", label: "Spotify", title: "Só Spotify", kinds: ["music", "albums", "artists"] },
  { key: "musicbrainz", label: "MusicBrainz", title: "Só MusicBrainz", kinds: ["music", "albums", "artists"] },
  { key: "lastfm", label: "Last.fm", title: "Só Last.fm", kinds: ["music", "albums", "artists"] },
  { key: "deezer", label: "Deezer", title: "Só Deezer — capa, data de lançamento, tipo, faixas, selo, imagem de artista; match por ISRC quando disponível", kinds: ["music", "albums", "artists"] },
  { key: "wikipedia", label: "Wikipedia", title: "Só Wikipedia", kinds: ["music", "albums", "artists"] },
  { key: "bugs", label: "Bugs", title: "Só Bugs (music.bugs.co.kr) — capa, data de single, data de álbum e data de clipe; boa cobertura de kpop", kinds: ["music", "albums"] },
];

const KIND_LABEL: Record<Kind, string> = {
  music: "Músicas",
  albums: "Álbuns",
  artists: "Artistas",
};

type FailedItem = { id: string | number; label: string; href: string; reason: string };

type BatchResponse = {
  ok?: boolean;
  processed?: number;
  updated?: number;
  remaining?: number;
  log?: string[];
  attemptedIds?: (string | number)[];
  failedItems?: FailedItem[];
  message?: string;
  status?: number;
  retryAfterMs?: number | null;
};

const CLIENT_BATCH_DELAY_MS = 700;
const MAX_CONSECUTIVE_STALLS = 6;
const STALL_BASE_DELAY_MS = 5000;
const STALL_MAX_DELAY_MS = 60000;
const LOG_MAX = 12;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

type Scope = "asian";

function useBatchBackfill(kind: Kind, initialTotal: number, scope?: Scope) {
  const router = useRouter();
  const [running, setRunning] = useState<Source | null>(null);
  const [force, setForce] = useState(false);
  const [total, setTotal] = useState(initialTotal);
  const [processed, setProcessed] = useState(0);
  const [updated, setUpdated] = useState(0);
  const [message, setMessage] = useState("");
  const [log, setLog] = useState<string[]>([]);
  const [failedItems, setFailedItems] = useState<FailedItem[]>([]);

  const percent = useMemo(() => {
    if (total <= 0) return 100;
    return Math.min(100, Math.round((processed / total) * 100));
  }, [processed, total]);

  async function run(source: Source) {
    if (running) return;
    setRunning(source);
    setProcessed(0);
    setUpdated(0);
    setLog([]);
    setFailedItems([]);
    setMessage("Buscando…");

    let nextRemaining = initialTotal;
    let processedSum = 0;
    let updatedSum = 0;
    let consecutiveStalls = 0;
    const exclude: (string | number)[] = [];
    const failedById = new Map<string | number, FailedItem>();

    try {
      while (nextRemaining > 0) {
        const res = await fetch("/api/admin/edicao-de-dados/backfill-source", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ kind, source, exclude, force, scope }),
        });
        const data = (await res.json().catch(() => ({}))) as BatchResponse;

        if (!res.ok || data.ok === false) {
          const rateLimited = data.status === 429;
          if (rateLimited && consecutiveStalls < MAX_CONSECUTIVE_STALLS) {
            consecutiveStalls += 1;
            const wait = Math.min(STALL_MAX_DELAY_MS, data.retryAfterMs ?? STALL_BASE_DELAY_MS * consecutiveStalls);
            setMessage(`Limitado pela API. Tentando de novo em ${Math.ceil(wait / 1000)}s...`);
            await sleep(wait);
            continue;
          }
          setMessage(data.message ?? "Não foi possível concluir a busca.");
          break;
        }

        const batchProcessed = data.processed ?? 0;
        processedSum += batchProcessed;
        updatedSum += data.updated ?? 0;
        nextRemaining = data.remaining ?? 0;

        setProcessed(processedSum);
        setUpdated(updatedSum);
        setTotal(processedSum + nextRemaining);
        if (data.log?.length) setLog((prev) => [...data.log!, ...prev].slice(0, LOG_MAX));

        for (const id of data.attemptedIds ?? []) exclude.push(id);
        if (data.failedItems?.length) {
          for (const item of data.failedItems) failedById.set(item.id, item);
          setFailedItems([...failedById.values()]);
        }

        if ((data.updated ?? 0) > 0) router.refresh();

        if (batchProcessed === 0) {
          if (nextRemaining === 0) break;
          consecutiveStalls += 1;
          if (consecutiveStalls > MAX_CONSECUTIVE_STALLS) {
            setMessage("A API continua limitando as requisições. Tente novamente mais tarde.");
            break;
          }
          const wait = Math.min(STALL_MAX_DELAY_MS, STALL_BASE_DELAY_MS * consecutiveStalls);
          setMessage(`Nada processado nesse lote. Tentando de novo em ${Math.ceil(wait / 1000)}s...`);
          await sleep(wait);
          continue;
        }

        consecutiveStalls = 0;
        setMessage(nextRemaining > 0 ? "Processando…" : "Concluído.");
        if (nextRemaining > 0) await sleep(CLIENT_BATCH_DELAY_MS);
      }
      if (failedById.size > 0 && nextRemaining === 0) {
        setMessage("Concluído. Alguns itens não retornaram dados — ajuste manual.");
      }
    } catch {
      setMessage("Erro de conexão durante a busca.");
    } finally {
      setRunning(null);
      router.refresh();
    }
  }

  return {
    running,
    force,
    setForce,
    total,
    processed,
    updated,
    message,
    log,
    failedItems,
    percent,
    run,
  };
}

function BackfillBody({
  kind,
  initialTotal,
  description,
  scope,
}: {
  kind: Kind;
  initialTotal: number;
  description: string;
  scope?: Scope;
}) {
  const {
    running,
    force,
    setForce,
    total,
    processed,
    updated,
    message,
    log,
    failedItems,
    percent,
    run,
  } = useBatchBackfill(kind, initialTotal, scope);

  return (
    <>
      <p style={{ margin: "0 0 14px", fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5 }}>
        {description}
      </p>

      <label
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 6,
          fontSize: 12,
          color: "var(--text-muted)",
          marginBottom: 14,
          cursor: running ? "default" : "pointer",
        }}
        title="Por padrão cada fonte só é consultada uma vez por registro — se não achar nada, fica marcada e é pulada nas próximas rodadas. Marque para forçar todas de novo."
      >
        <input
          type="checkbox"
          checked={force}
          disabled={running != null}
          onChange={(e) => setForce(e.target.checked)}
        />
        Forçar (ignora &quot;sem resultado&quot; e consulta tudo de novo)
      </label>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, marginBottom: 18 }}>
        {SOURCES.filter((s) => s.kinds.includes(kind)).map((s) => {
          const isRunning = running === s.key;
          const disabled = running != null || total === 0;
          return (
            <button
              key={s.key}
              type="button"
              title={s.title}
              onClick={() => run(s.key)}
              disabled={disabled}
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: 6,
                minHeight: 36,
                padding: "0 13px",
                borderRadius: 9,
                border: s.key === "all" ? "none" : "1px solid var(--divider-strong)",
                background: disabled
                  ? "var(--fill-inset)"
                  : s.key === "all"
                    ? "#FA243C"
                    : "var(--surface)",
                color: disabled ? "var(--text-muted)" : s.key === "all" ? "#fff" : "var(--text)",
                fontSize: 12.5,
                fontWeight: s.key === "all" ? 750 : 600,
                cursor: disabled ? "default" : "pointer",
              }}
            >
              {isRunning && <Loader2 size={14} style={{ animation: "spin 1s linear infinite" }} />}
              {s.label}
            </button>
          );
        })}
      </div>

      <div style={{ height: 8, borderRadius: 999, background: "var(--fill-inset)", overflow: "hidden" }}>
        <div
          style={{
            width: `${percent}%`,
            height: "100%",
            borderRadius: 999,
            background: "#FA243C",
            transition: "width 180ms ease",
          }}
        />
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, marginTop: 8, flexWrap: "wrap" }}>
        <span style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12.5, color: "var(--text-muted)" }}>
          {percent === 100 && !running && processed > 0 ? (
            <CheckCircle2 size={14} color="#2D7A32" />
          ) : (
            <AlertCircle size={14} color="#86868B" />
          )}
          {message || `${total.toLocaleString("pt-BR")} pendente(s)`}
        </span>
        <span style={{ fontSize: 12.5, color: "var(--text-muted)" }}>
          {processed.toLocaleString("pt-BR")}/{total.toLocaleString("pt-BR")} · {updated.toLocaleString("pt-BR")} atualizados
        </span>
      </div>

      {log.length > 0 && (
        <div
          style={{
            marginTop: 14,
            padding: "10px 12px",
            borderRadius: 10,
            background: "var(--fill-inset)",
            fontSize: 12,
            lineHeight: 1.7,
            color: "var(--text-muted)",
            maxHeight: 220,
            overflowY: "auto",
          }}
        >
          {log.map((line, i) => (
            <div key={`${line}-${i}`} style={line.startsWith("✓") ? { color: "#2D7A32" } : undefined}>
              {line}
            </div>
          ))}
        </div>
      )}

      {failedItems.length > 0 && !running && (
        <div style={{ marginTop: 12, fontSize: 13, color: "var(--text-muted)" }}>
          {failedItems.length.toLocaleString("pt-BR")} sem resultado nesta rodada:
          <div style={{ marginTop: 6, display: "flex", flexDirection: "column", gap: 4 }}>
            {failedItems.slice(0, 20).map((item) => (
              <Link
                key={`${item.id}`}
                href={item.href}
                style={{ color: "#FA243C", fontWeight: 700, textDecoration: "none", fontSize: 13 }}
              >
                {item.label}
              </Link>
            ))}
            {failedItems.length > 20 && <span>… e mais {failedItems.length - 20}</span>}
          </div>
        </div>
      )}
    </>
  );
}

/**
 * Backfill em lote por tipo: abre sob demanda em um drawer lateral
 * para manter a tabela principal compacta.
 */
export function BackfillDrawerButton({
  kind,
  initialTotal,
  description,
  buttonLabel,
  scope,
}: {
  kind: Kind;
  initialTotal: number;
  description: string;
  /** Rótulo do botão; padrão: "Backfill em lote (N)". */
  buttonLabel?: string;
  /** Restringe o lote a um subconjunto (hoje só "asian" — música k-pop/j-pop/c-pop/t-pop). */
  scope?: Scope;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open]);

  const label = buttonLabel ?? `Backfill em lote (${initialTotal.toLocaleString("pt-BR")})`;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: 7,
          padding: "10px 16px",
          borderRadius: 10,
          border: "1px solid rgba(250,36,60,0.35)",
          background: "rgba(250,36,60,0.08)",
          color: "#FA243C",
          fontSize: 13,
          fontWeight: 750,
          cursor: "pointer",
          whiteSpace: "nowrap",
        }}
      >
        <Layers size={15} />
        {label}
      </button>

      {open && (
        <>
          <div
            role="presentation"
            onClick={() => setOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(0,0,0,0.35)",
              zIndex: 40,
            }}
          />
          <aside
            role="dialog"
            aria-modal="true"
            aria-label={`Backfill em lote · ${KIND_LABEL[kind]}`}
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              bottom: 0,
              width: "min(420px, 100vw)",
              background: "var(--surface-elevated, var(--surface))",
              borderLeft: "1px solid var(--divider)",
              zIndex: 41,
              boxShadow: "-8px 0 24px rgba(0,0,0,0.12)",
              display: "flex",
              flexDirection: "column",
              animation: "dadosDrawerIn 220ms ease",
            }}
          >
            <div
              style={{
                padding: "18px 20px",
                borderBottom: "1px solid var(--divider)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: 12,
              }}
            >
              <div style={{ fontSize: 15, fontWeight: 750, color: "var(--text)" }}>
                Backfill em lote · {KIND_LABEL[kind]}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fechar"
                style={{
                  border: "none",
                  background: "transparent",
                  cursor: "pointer",
                  color: "var(--text-muted)",
                  padding: "2px 6px",
                  display: "inline-flex",
                }}
              >
                <X size={20} />
              </button>
            </div>
            <div style={{ padding: 20, overflowY: "auto", flex: 1 }}>
              <BackfillBody kind={kind} initialTotal={initialTotal} description={description} scope={scope} />
            </div>
          </aside>
          <style>{`@keyframes dadosDrawerIn { from { transform: translateX(24px); opacity: 0; } to { transform: translateX(0); opacity: 1; } }`}</style>
        </>
      )}
    </>
  );
}

/** Card da visão geral: abre o mesmo drawer ao clicar em "Abrir backfill em lote". */
export function BackfillToolCard({
  kind,
  title,
  description,
  initialTotal,
}: {
  kind: Kind;
  title: string;
  description: string;
  initialTotal: number;
}) {
  return (
    <div
      style={{
        background: "var(--surface)",
        border: "1px solid var(--divider)",
        borderRadius: 14,
        padding: 16,
      }}
    >
      <div style={{ fontSize: 14.5, fontWeight: 750, color: "var(--text)" }}>{title}</div>
      <div style={{ marginTop: 5, fontSize: 12.5, color: "var(--text-muted)", lineHeight: 1.5, minHeight: 36 }}>
        {description}
      </div>
      <div style={{ marginTop: 10 }}>
        <BackfillDrawerButton
          kind={kind}
          initialTotal={initialTotal}
          description={description}
          buttonLabel={`Abrir backfill em lote (${initialTotal.toLocaleString("pt-BR")})`}
        />
      </div>
    </div>
  );
}

/**
 * @deprecated Preferir BackfillDrawerButton / BackfillToolCard.
 * Mantido para compatibilidade: renderiza o fluxo no drawer via botão embutido.
 */
export function SourceBatchBackfillClient({
  kind,
  title,
  description,
  initialTotal,
}: {
  kind: Kind;
  title: string;
  description: string;
  initialTotal: number;
}) {
  return (
    <BackfillToolCard kind={kind} title={title} description={description} initialTotal={initialTotal} />
  );
}
