"use client";

import { useState, useEffect, useRef, useMemo } from "react";
import { useIsMobile } from "@/hooks/useIsMobile";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { ClubeRoundData, ClubeWinner, UiPhase } from "@/lib/clube-album";
import { MIN_POLL_VOTES } from "@/lib/clube-album-shared";
import { formatCountdown } from "@/lib/clube-schedule";
import { scoreColor } from "@/lib/album-score";

type SpotifySearchHit = {
  spotifyId: string;
  title: string;
  artist: string;
  coverUrl: string | null;
  releaseDate: string | null;
  dbId: number | null;
  inDb: boolean;
};

type PickAlbum = {
  albumId: number;
  title: string;
  artist: string;
  year: string;
  coverUrl: string | null;
};

function albumHue(title: string): number {
  return Math.abs(title.split("").reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0)) % 360;
}

function AlbumCover({
  title,
  coverUrl,
  size = 56,
  radius = 8,
}: {
  title: string;
  coverUrl?: string | null;
  size?: number;
  radius?: number;
}) {
  if (coverUrl) {
    return (
      <img
        src={coverUrl}
        alt={title}
        style={{ width: size, height: size, borderRadius: radius, objectFit: "cover", flexShrink: 0, display: "block" }}
      />
    );
  }
  const hue = albumHue(title);
  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        background: `hsl(${hue},45%,55%)`,
        display: "grid",
        placeItems: "center",
        color: "white",
        fontSize: Math.max(11, Math.floor(size * 0.4)),
        fontWeight: 800,
        flexShrink: 0,
        userSelect: "none",
      }}
    >
      {title[0]?.toUpperCase()}
    </div>
  );
}

function SpotifyIcon({ size = 12 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.521 17.34c-.24.359-.66.48-1.021.24-2.82-1.74-6.36-2.101-10.561-1.141-.418.122-.779-.179-.899-.539-.12-.421.18-.78.54-.9 4.56-1.021 8.52-.6 11.64 1.32.42.18.479.659.301 1.02zm1.44-3.3c-.301.42-.841.6-1.262.3-3.239-1.98-8.159-2.58-11.939-1.38-.479.12-1.02-.12-1.14-.6-.12-.48.12-1.021.6-1.141C9.6 9.9 15 10.561 18.72 12.84c.361.181.54.78.241 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.301c-.6.179-1.2-.181-1.38-.721-.18-.601.18-1.2.72-1.381 4.26-1.26 11.28-1.02 15.721 1.621.539.3.719 1.02.419 1.56-.299.421-1.02.599-1.559.3z" />
    </svg>
  );
}

function SearchModal({
  nominatedAlbumIds,
  pastNominatedAlbumIds,
  excludeAlbumIds,
  onClose,
  onSelect,
}: {
  nominatedAlbumIds: Set<number>;
  pastNominatedAlbumIds: Set<number>;
  excludeAlbumIds: number[];
  onClose: () => void;
  onSelect: (album: PickAlbum) => void;
}) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SpotifySearchHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [adding, setAdding] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!q.trim()) {
      setResults([]);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/criticsfm/search-spotify?q=${encodeURIComponent(q.trim())}`);
        const data = (await res.json()) as { results: SpotifySearchHit[] };
        setResults(data.results ?? []);
      } finally {
        setLoading(false);
      }
    }, 400);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [q]);

  async function pick(hit: SpotifySearchHit) {
    let albumId = hit.dbId;
    if (!albumId) {
      setAdding(hit.spotifyId);
      try {
        const res = await fetch("/api/criticsfm/search-spotify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ spotifyAlbumId: hit.spotifyId }),
        });
        if (!res.ok) return;
        const data = (await res.json()) as { id: number };
        albumId = data.id;
      } finally {
        setAdding(null);
      }
    }
    if (!albumId) return;
    onSelect({
      albumId,
      title: hit.title,
      artist: hit.artist,
      year: hit.releaseDate?.slice(0, 4) ?? "—",
      coverUrl: hit.coverUrl,
    });
  }

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(0,0,0,0.45)",
        zIndex: 1000,
        display: "flex",
        alignItems: "flex-start",
        justifyContent: "center",
        padding: "60px 12px 0",
        backdropFilter: "blur(4px)",
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          background: "var(--surface)",
          borderRadius: 20,
          width: "100%",
          maxWidth: 520,
          boxShadow: "0 20px 60px rgba(0,0,0,0.28)",
          overflow: "hidden",
        }}
      >
        <div style={{ padding: "20px 20px 0", display: "flex", alignItems: "center", gap: 10 }}>
          <SpotifyIcon size={18} />
          <span style={{ fontSize: 15, fontWeight: 700, color: "var(--text)" }}>Buscar no Spotify</span>
          <button
            onClick={onClose}
            style={{ marginLeft: "auto", background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 22, lineHeight: 1, padding: 4 }}
          >
            ×
          </button>
        </div>
        <div style={{ padding: "14px 20px" }}>
          <input
            ref={inputRef}
            type="text"
            placeholder="Nome do álbum ou artista…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            style={{
              width: "100%",
              padding: "10px 16px",
              borderRadius: 12,
              border: "1px solid var(--divider-strong)",
              fontSize: 14,
              fontFamily: "inherit",
              outline: "none",
              background: "var(--fill-inset)",
              color: "var(--text)",
              boxSizing: "border-box",
            }}
          />
        </div>
        <div style={{ maxHeight: 380, overflowY: "auto", padding: "0 12px 16px" }}>
          {loading && <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)", fontSize: 13 }}>Buscando…</div>}
          {!loading && q.trim() && results.length === 0 && (
            <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-muted)", fontSize: 13 }}>Nenhum resultado</div>
          )}
          {!loading &&
            results.map((hit) => {
              const dbId = hit.dbId;
              const taken = dbId ? nominatedAlbumIds.has(dbId) : false;
              const takenPrev = dbId ? (!taken && pastNominatedAlbumIds.has(dbId)) : false;
              const selected = dbId ? excludeAlbumIds.includes(dbId) : false;
              return (
                <div
                  key={hit.spotifyId}
                  style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 8px", borderBottom: "1px solid var(--divider-soft)" }}
                >
                  <AlbumCover title={hit.title} coverUrl={hit.coverUrl} size={44} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {hit.title}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 1 }}>
                      {hit.artist}
                      {hit.releaseDate ? ` · ${hit.releaseDate.slice(0, 4)}` : ""}
                    </div>
                  </div>
                  {taken ? (
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", padding: "5px 10px", borderRadius: 100, background: "var(--fill-inset)", whiteSpace: "nowrap" }}>
                      Já indicado
                    </span>
                  ) : takenPrev ? (
                    <span title="Este álbum já foi indicado em uma rodada anterior" style={{ fontSize: 11, fontWeight: 600, color: "#b45309", padding: "5px 10px", borderRadius: 100, background: "rgba(180,83,9,0.10)", whiteSpace: "nowrap" }}>
                      Rodada anterior
                    </span>
                  ) : selected ? (
                    <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-muted)", padding: "5px 10px", borderRadius: 100, background: "var(--fill-inset)", whiteSpace: "nowrap" }}>
                      Selecionado
                    </span>
                  ) : (
                    <button
                      onClick={() => pick(hit)}
                      disabled={adding === hit.spotifyId}
                      style={{
                        padding: "7px 14px",
                        borderRadius: 100,
                        border: "none",
                        background: "var(--btn-dark-bg)",
                        color: "var(--btn-dark-fg)",
                        fontSize: 12,
                        fontWeight: 600,
                        cursor: adding === hit.spotifyId ? "default" : "pointer",
                        fontFamily: "inherit",
                        whiteSpace: "nowrap",
                        opacity: adding === hit.spotifyId ? 0.6 : 1,
                      }}
                    >
                      {adding === hit.spotifyId ? "…" : "Indicar"}
                    </button>
                  )}
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}

const PHASE_META = [
  { id: "1", label: "Inscrições" },
  { id: "2", label: "Enquete" },
  { id: "3", label: "Resultado" },
  { id: "4", label: "Escuta" },
];

function PhaseSteps({ current, isMobile }: { current: UiPhase; isMobile?: boolean }) {
  const ci = current === "0" ? 0 : parseInt(current);
  const circleSize = isMobile ? 24 : 28;
  return (
    <div style={{ display: "flex", alignItems: "flex-start", marginBottom: isMobile ? 18 : 24 }}>
      {PHASE_META.map((p, i) => {
        const pi = parseInt(p.id);
        const active = pi === ci;
        const done = pi < ci;
        return (
          <div key={p.id} style={{ display: "contents" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
              <div
                style={{
                  width: circleSize,
                  height: circleSize,
                  borderRadius: "50%",
                  background: active || done ? "var(--accent)" : "var(--fill-inset)",
                  border: active || done ? "none" : "1.5px solid var(--divider-strong)",
                  display: "grid",
                  placeItems: "center",
                  fontSize: isMobile ? 10 : 11,
                  fontWeight: 700,
                  color: active || done ? "white" : "var(--text-muted)",
                  flexShrink: 0,
                }}
              >
                {done ? (
                  <svg width={isMobile ? 10 : 12} height={isMobile ? 10 : 12} viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                ) : (
                  p.id
                )}
              </div>
              <span style={{ fontSize: isMobile ? 10 : 11, fontWeight: active ? 700 : 500, color: active ? "var(--accent)" : "var(--text-muted)", whiteSpace: "nowrap" }}>
                {p.label}
              </span>
            </div>
            {i < PHASE_META.length - 1 && (
              <div
                style={{
                  flex: 1,
                  height: 1.5,
                  background: parseInt(PHASE_META[i + 1].id) <= ci ? "var(--accent)" : "var(--divider-strong)",
                  margin: `${isMobile ? 11 : 13}px 4px 0`,
                  minWidth: 8,
                }}
              />
            )}
          </div>
        );
      })}
    </div>
  );
}

const PHASE_STATUS: Record<UiPhase, { label: string; dot: string }> = {
  "0": { label: "Aguardando inscrições", dot: "#86868B" },
  "1": { label: "Inscrições abertas", dot: "#1B873F" },
  "2": { label: "Enquete aberta", dot: "#E09F00" },
  "3": { label: "Resultado publicado", dot: "var(--accent)" },
  "4": { label: "Período de escuta", dot: "#5856D6" },
};

function ClubHeader({ round, isMobile }: { round: ClubeRoundData; isMobile?: boolean }) {
  const s = PHASE_STATUS[round.phase];
  return (
    <div style={{ display: "flex", alignItems: "flex-start", marginBottom: isMobile ? 16 : 22, gap: 8 }}>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ display: "flex", alignItems: "center", gap: isMobile ? 6 : 10, marginBottom: 8, flexWrap: "wrap" }}>
          <h2 style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text)", margin: 0 }}>Clube do Álbum</h2>
          <span style={{ fontSize: 12, fontWeight: 400, color: "var(--text-disabled)" }}>Rodada #{round.number}</span>
        </div>
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 5,
            background: "var(--fill-inset)",
            borderRadius: 100,
            padding: "4px 10px",
            fontSize: 11,
            fontWeight: 600,
            color: "var(--text-subtle)",
            border: "1px solid var(--divider)",
          }}
        >
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.dot, display: "inline-block", flexShrink: 0 }} />
          {s.label}
        </span>
      </div>
    </div>
  );
}

function HowItWorks() {
  const [open, setOpen] = useState(false);
  const steps = [
    { num: "1", title: "Inscrições", desc: "Cada membro indica até 2 álbuns de acordo com o tema da semana." },
    { num: "2", title: "Enquete", desc: "Com as indicações reunidas, uma enquete é aberta. Vote em pelo menos 7 álbuns." },
    { num: "3", title: "Resultado", desc: "Os 2 álbuns com mais votos são escolhidos para a semana." },
    { num: "4", title: "Escuta", desc: "Ouça os álbuns escolhidos. Quem indicou e a nota CriticsFM são revelados na quarta às 20h." },
  ];
  return (
    <div style={{ marginBottom: 24 }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{ display: "flex", alignItems: "center", gap: 6, background: "none", border: "none", cursor: "pointer", fontSize: 13, fontWeight: 600, color: "var(--text-muted)", padding: 0, fontFamily: "inherit" }}
      >
        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="10" />
          <path d="M12 16v-4" />
          <path d="M12 8h.01" />
        </svg>
        Como funciona?
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" style={{ transform: open ? "rotate(180deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div style={{ marginTop: 14, display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
          {steps.map((s) => (
            <div key={s.num} style={{ background: "var(--fill-inset)", borderRadius: 12, padding: "12px 14px", border: "1px solid var(--divider)" }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--accent)", marginBottom: 5 }}>Fase {s.num} — {s.title}</div>
              <div style={{ fontSize: 12, color: "var(--text-muted)", lineHeight: 1.55 }}>{s.desc}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function WinnerCard({ album, idx, revealed }: { album: ClubeWinner; idx: number; revealed: boolean }) {
  const hue = albumHue(album.title);
  return (
    <div style={{ background: "var(--surface)", border: "1px solid var(--divider)", borderRadius: 20, overflow: "hidden", boxShadow: "0 2px 12px rgba(0,0,0,0.05)", width: "100%" }}>
      <Link
        href={`/criticsfm/${album.albumId}`}
        title={`Avaliar ${album.title}`}
        style={{
          display: "block",
          width: "50%",
          margin: "16px auto 0",
          aspectRatio: "1/1",
          borderRadius: 14,
          overflow: "hidden",
          background: album.coverUrl ? undefined : `hsl(${hue},45%,55%)`,
          color: "white",
          fontSize: 38,
          fontWeight: 800,
          position: "relative",
          cursor: "pointer",
        }}
      >
        {album.coverUrl ? (
          <img src={album.coverUrl} alt={album.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <div style={{ position: "absolute", inset: 0, display: "grid", placeItems: "center" }}>{album.title[0]?.toUpperCase()}</div>
        )}
        <div style={{ position: "absolute", top: 8, left: 8, background: "rgba(0,0,0,0.55)", backdropFilter: "blur(8px)", color: "white", borderRadius: 100, padding: "4px 10px", fontSize: 11, fontWeight: 700, display: "flex", alignItems: "center", gap: 5 }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="white">
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          #{idx + 1}
        </div>
        {revealed && album.score !== null && (
          <div style={{ position: "absolute", top: 8, right: 8, background: scoreColor(album.score), color: "white", borderRadius: 100, padding: "4px 10px", fontSize: 12, fontWeight: 800, boxShadow: "0 2px 8px rgba(0,0,0,0.25)" }}>
            {album.score}
          </div>
        )}
      </Link>
      <div style={{ padding: "16px" }}>
        <Link href={`/criticsfm/${album.albumId}`} style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 700, color: "var(--accent)", textDecoration: "none", marginBottom: 8 }}>
          Avaliar álbum →
        </Link>
        <div style={{ fontSize: 17, fontWeight: 800, letterSpacing: "-0.02em", color: "var(--text)", marginBottom: 2 }}>{album.title}</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 14 }}>{album.artist} · {album.year}</div>
        {revealed && album.nominatedBy && (
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
            Indicado por <strong style={{ color: "var(--text)" }}>@{album.nominatedBy}</strong>
            {album.reviewCount > 0 && album.score !== null && (
              <span> · {album.reviewCount} review{album.reviewCount !== 1 ? "s" : ""}</span>
            )}
          </div>
        )}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            <strong style={{ color: "var(--text)" }}>{album.votes}</strong> votos
          </span>
          {album.spotifyUrl && (
            <a href={album.spotifyUrl} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 5, background: "#1DB954", color: "white", padding: "7px 14px", borderRadius: 100, fontSize: 12, fontWeight: 700, textDecoration: "none" }}>
              <SpotifyIcon size={11} /> Ouvir
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

function Phase0({ round, isMobile }: { round: ClubeRoundData; isMobile?: boolean }) {
  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    if (!round.nextRoundStartsAt) return;
    const target = new Date(round.nextRoundStartsAt);
    const tick = () => setCountdown(formatCountdown(target));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [round.nextRoundStartsAt]);

  return (
    <div>
      <div style={{ background: "var(--fill-inset)", border: "1px solid var(--divider)", borderRadius: 16, padding: isMobile ? "20px 16px" : "28px 24px", textAlign: "center", marginBottom: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10 }}>
          Próxima rodada
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text)", marginBottom: 8 }}>{round.theme}</div>
        <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 16 }}>
          Inscrições abrem em <strong style={{ color: "var(--text)" }}>{round.nominationsOpenAt}</strong>
        </div>
        {countdown && (
          <div style={{ display: "inline-flex", alignItems: "center", gap: 8, background: "var(--surface)", borderRadius: 100, padding: "8px 16px", border: "1px solid var(--divider)", fontSize: 14, fontWeight: 700, color: "var(--accent)", fontVariantNumeric: "tabular-nums" }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
            {countdown}
          </div>
        )}
      </div>
      <p style={{ fontSize: 13, color: "var(--text-muted)", textAlign: "center", lineHeight: 1.55 }}>
        O tema já foi definido. Volte na quarta-feira às 6h para fazer suas indicações.
      </p>
    </div>
  );
}

function Phase1({ round, isMobile }: { round: ClubeRoundData; isMobile?: boolean }) {
  const router = useRouter();
  const alreadyNominated = (round.myNominations?.length ?? 0) === 2;
  const [myNoms, setMyNoms] = useState<(PickAlbum | null)[]>(
    alreadyNominated
      ? round.myNominations!.map((n) => ({ albumId: n.albumId, title: n.title, artist: n.artist, year: n.year, coverUrl: n.coverUrl }))
      : [null, null],
  );
  const [slot, setSlot] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(alreadyNominated);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const nominatedAlbumIds = useMemo(() => new Set(round.nominations.map((n) => n.albumId)), [round.nominations]);
  const pastNominatedAlbumIds = useMemo(() => {
    const current = nominatedAlbumIds;
    return new Set(round.allNominatedAlbumIds.filter((id) => !current.has(id)));
  }, [round.allNominatedAlbumIds, nominatedAlbumIds]);

  async function confirm() {
    if (!myNoms[0] || !myNoms[1]) return;
    if (!round.isLoggedIn) {
      setError("Faça login para indicar álbuns");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/clube/nominations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roundId: round.id, albumIds: [myNoms[0].albumId, myNoms[1].albumId] }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Erro ao confirmar");
        return;
      }
      setSubmitted(true);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      {slot !== null && (
        <SearchModal
          nominatedAlbumIds={nominatedAlbumIds}
          pastNominatedAlbumIds={pastNominatedAlbumIds}
          excludeAlbumIds={myNoms.filter(Boolean).map((a) => a!.albumId)}
          onClose={() => setSlot(null)}
          onSelect={(album) => {
            setMyNoms((prev) => {
              const n = [...prev];
              n[slot] = album;
              return n;
            });
            setSlot(null);
          }}
        />
      )}

      <div style={{ background: "linear-gradient(135deg,var(--accent) 0%,#FF5858 100%)", borderRadius: 16, padding: isMobile ? "16px 18px" : "22px 24px", marginBottom: 28, color: "white", boxShadow: "0 4px 20px rgba(250,36,60,0.22)" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", opacity: 0.8, marginBottom: 6 }}>Tema desta semana</div>
        <div style={{ fontSize: isMobile ? 20 : 24, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 10 }}>{round.theme}</div>
        <div style={{ fontSize: 13, opacity: 0.85, display: "flex", alignItems: "center", gap: 6 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <polyline points="12 6 12 12 16 14" />
          </svg>
          Inscrições até {round.nominationsDeadline}
        </div>
      </div>

      {!round.isLoggedIn && (
        <div style={{ background: "var(--fill-inset)", border: "1px solid var(--divider)", borderRadius: 12, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "var(--text-muted)" }}>
          <Link href="/login" style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>Entre na sua conta</Link> para fazer suas indicações.
        </div>
      )}

      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 14 }}>
          {submitted ? "Suas indicações ✓" : "Suas indicações — escolha 2 álbuns"}
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          {[0, 1].map((i) => (
            <div key={i}>
              {myNoms[i] ? (
                <div style={{ background: "var(--surface)", border: submitted ? "1.5px solid var(--accent)" : "1px solid var(--divider)", borderRadius: 14, padding: "14px", display: "flex", gap: 12, alignItems: "center" }}>
                  <AlbumCover title={myNoms[i]!.title} coverUrl={myNoms[i]!.coverUrl} size={48} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{myNoms[i]!.title}</div>
                    <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{myNoms[i]!.artist}</div>
                    <div style={{ fontSize: 11, color: "var(--text-disabled)", marginTop: 1 }}>{myNoms[i]!.year}</div>
                  </div>
                  {!submitted && round.isLoggedIn ? (
                    <button onClick={() => setMyNoms((p) => { const n = [...p]; n[i] = null; return n; })} style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)", fontSize: 22, padding: 4, lineHeight: 1 }}>×</button>
                  ) : submitted ? (
                    <div style={{ width: 22, height: 22, borderRadius: "50%", background: "var(--accent)", display: "grid", placeItems: "center", flexShrink: 0 }}>
                      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                    </div>
                  ) : null}
                </div>
              ) : (
                <button
                  onClick={() => round.isLoggedIn && setSlot(i)}
                  disabled={!round.isLoggedIn}
                  style={{ width: "100%", background: "var(--fill-inset)", border: "1.5px dashed var(--divider-strong)", borderRadius: 14, padding: "22px 14px", display: "flex", flexDirection: "column", alignItems: "center", gap: 8, cursor: round.isLoggedIn ? "pointer" : "default", color: "var(--text-muted)", fontFamily: "inherit", opacity: round.isLoggedIn ? 1 : 0.6 }}
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                    <circle cx="12" cy="12" r="9" />
                    <line x1="12" y1="8" x2="12" y2="16" />
                    <line x1="8" y1="12" x2="16" y2="12" />
                  </svg>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Indicação {i + 1}</span>
                </button>
              )}
            </div>
          ))}
        </div>

        {error && <div style={{ color: "#C5291C", fontSize: 13, marginBottom: 12 }}>{error}</div>}

        {myNoms.every(Boolean) && !submitted && round.isLoggedIn && (
          <button
            onClick={confirm}
            disabled={submitting}
            style={{ width: "100%", padding: "13px", borderRadius: 12, border: "none", background: "var(--accent)", color: "white", fontSize: 14, fontWeight: 700, cursor: submitting ? "default" : "pointer", fontFamily: "inherit", boxShadow: "0 2px 12px rgba(250,36,60,0.28)", opacity: submitting ? 0.7 : 1 }}
          >
            {submitting ? "Confirmando…" : "Confirmar indicações"}
          </button>
        )}

        {submitted && (
          <div style={{ background: "rgba(27,135,63,0.08)", border: "1px solid rgba(27,135,63,0.2)", borderRadius: 12, padding: "12px 16px", display: "flex", alignItems: "center", gap: 10, color: "#1B873F", fontSize: 13, fontWeight: 600 }}>
            Indicações confirmadas! Aguarde a abertura da enquete.
          </div>
        )}
      </div>

      <div>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 14, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
          <span>Indicações da rodada</span>
          <span style={{ fontSize: 12, letterSpacing: 0, textTransform: "none", fontWeight: 400, color: "var(--text-muted)" }}>
            {round.nominations.length} álbuns · {round.participantCount} membros
          </span>
        </div>
        {!round.identitiesRevealed && round.revealsAt && (
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 12, padding: "10px 12px", background: "var(--fill-inset)", borderRadius: 10, border: "1px solid var(--divider)" }}>
            Quem indicou cada álbum será revelado em {round.revealsAt}.
          </div>
        )}
        {round.nominations.length === 0 ? (
          <div style={{ textAlign: "center", padding: "32px 16px", color: "var(--text-muted)", fontSize: 13, background: "var(--fill-inset)", borderRadius: 12, border: "1px solid var(--divider)" }}>
            Nenhuma indicação ainda. Seja o primeiro!
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {round.nominations.map((a) => (
              <div key={a.id} style={{ background: "var(--surface)", border: "1px solid var(--divider)", borderRadius: 12, padding: "10px 14px", display: "flex", alignItems: "center", gap: 12 }}>
                <AlbumCover title={a.title} coverUrl={a.coverUrl} size={40} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>{a.artist} · {a.year}</div>
                </div>
                <span style={{ fontSize: 11, color: "var(--text-disabled)", whiteSpace: "nowrap" }}>
                  {a.nominatedBy ? `@${a.nominatedBy}` : "—"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function Phase2({ round, isMobile }: { round: ClubeRoundData; isMobile?: boolean }) {
  const router = useRouter();
  const [savedVotes, setSavedVotes] = useState<string[]>(round.myVoteNominationIds ?? []);
  const [selected, setSelected] = useState<string[]>(round.myVoteNominationIds ?? []);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ids = round.myVoteNominationIds ?? [];
    setSavedVotes(ids);
    setSelected(ids);
  }, [round.id, round.myVoteNominationIds?.join(",")]);

  const hasVoted = savedVotes.length >= MIN_POLL_VOTES;
  const isDirty =
    [...selected].sort().join(",") !== [...savedVotes].sort().join(",");
  const canSubmit = selected.length >= MIN_POLL_VOTES && isDirty;

  function toggle(id: string) {
    if (!round.isLoggedIn) return;
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function resetSelection() {
    setSelected(savedVotes);
    setError(null);
  }

  async function vote() {
    if (selected.length < MIN_POLL_VOTES) return;
    if (!round.isLoggedIn) {
      setError("Faça login para votar");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/clube/votes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roundId: round.id, nominationIds: selected }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Erro ao votar");
        return;
      }
      setSavedVotes([...selected]);
      router.refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <div style={{ background: "linear-gradient(135deg,var(--accent) 0%,#FF5858 100%)", borderRadius: 16, padding: isMobile ? "16px 18px" : "22px 24px", marginBottom: 28, color: "white", boxShadow: "0 4px 20px rgba(250,36,60,0.22)" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", opacity: 0.8, marginBottom: 6 }}>Enquete · {round.theme}</div>
        <div style={{ fontSize: isMobile ? 18 : 22, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 10 }}>Vote nos álbuns que quer ouvir</div>
        <div style={{ fontSize: 13, opacity: 0.85, display: "flex", alignItems: "center", gap: 6 }}>
          Enquete aberta até {round.pollDeadline}
        </div>
      </div>

      {!round.isLoggedIn && (
        <div style={{ background: "var(--fill-inset)", border: "1px solid var(--divider)", borderRadius: 12, padding: "12px 16px", marginBottom: 20, fontSize: 13, color: "var(--text-muted)" }}>
          <Link href="/login" style={{ color: "var(--accent)", fontWeight: 600, textDecoration: "none" }}>Entre na sua conta</Link> para votar.
        </div>
      )}

      {(!hasVoted || isDirty) && (
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 20 }}>
          <div style={{ flex: 1, height: 5, background: "var(--fill-inset)", borderRadius: 100, overflow: "hidden" }}>
            <div style={{ height: "100%", width: `${Math.min(100, (selected.length / MIN_POLL_VOTES) * 100)}%`, background: selected.length >= MIN_POLL_VOTES ? "#1B873F" : "var(--accent)", borderRadius: 100, transition: "width 0.2s, background 0.2s" }} />
          </div>
          <span style={{ fontSize: 12, fontWeight: 700, color: selected.length >= MIN_POLL_VOTES ? "#1B873F" : "var(--text-muted)", whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>
            {selected.length} / {MIN_POLL_VOTES} mín.
          </span>
        </div>
      )}

      {hasVoted && !isDirty && (
        <div style={{ background: "rgba(27,135,63,0.08)", border: "1px solid rgba(27,135,63,0.2)", borderRadius: 12, padding: "12px 16px", marginBottom: 20, color: "#1B873F", fontSize: 13, fontWeight: 600, lineHeight: 1.5 }}>
          Voto registrado em {savedVotes.length} álbuns. Toque nos cards para alterar — você pode editar até {round.pollDeadline}.
        </div>
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(118px,1fr))", gap: 10, marginBottom: 24 }}>
        {round.nominations.map((a) => {
          const sel = selected.includes(a.id);
          const hue = albumHue(a.title);
          return (
            <div
              key={a.id}
              onClick={() => toggle(a.id)}
              style={{ background: "var(--surface)", border: sel ? "2px solid var(--accent)" : "1px solid var(--divider)", borderRadius: 14, overflow: "hidden", cursor: round.isLoggedIn ? "pointer" : "default", boxShadow: sel ? "0 0 0 3px var(--accent-tint)" : "none", position: "relative" }}
            >
              <div style={{ width: "100%", aspectRatio: "1/1", background: a.coverUrl ? undefined : `hsl(${hue},45%,55%)`, display: "grid", placeItems: "center", color: "white", fontSize: 40, fontWeight: 800, position: "relative" }}>
                {a.coverUrl ? <img src={a.coverUrl} alt={a.title} style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover" }} /> : a.title[0]?.toUpperCase()}
                {sel && (
                  <div style={{ position: "absolute", top: 8, right: 8, width: 24, height: 24, borderRadius: "50%", background: "var(--accent)", display: "grid", placeItems: "center", boxShadow: "0 2px 6px rgba(0,0,0,0.25)" }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round"><polyline points="20 6 9 17 4 12" /></svg>
                  </div>
                )}
              </div>
              <div style={{ padding: "10px 12px 12px" }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{a.artist}</div>
              </div>
            </div>
          );
        })}
      </div>

      {error && <div style={{ color: "#C5291C", fontSize: 13, marginBottom: 12 }}>{error}</div>}

      {canSubmit ? (
        <div style={{ display: "flex", gap: 10, flexDirection: "column" }}>
          <button
            onClick={vote}
            disabled={submitting || !round.isLoggedIn}
            style={{ width: "100%", padding: "13px", borderRadius: 12, border: "none", background: round.isLoggedIn ? "var(--accent)" : "var(--fill-inset)", color: round.isLoggedIn ? "white" : "var(--text-disabled)", fontSize: 14, fontWeight: 700, cursor: round.isLoggedIn ? "pointer" : "default", fontFamily: "inherit" }}
          >
            {submitting
              ? "Registrando…"
              : hasVoted
                ? `Salvar alterações (${selected.length} álbuns)`
                : `Votar em ${selected.length} álbuns →`}
          </button>
          {hasVoted && isDirty && (
            <button
              type="button"
              onClick={resetSelection}
              disabled={submitting}
              style={{ width: "100%", padding: "11px", borderRadius: 12, border: "1px solid var(--divider)", background: "transparent", color: "var(--text-muted)", fontSize: 13, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}
            >
              Descartar alterações
            </button>
          )}
        </div>
      ) : !hasVoted ? (
        <button
          disabled
          style={{ width: "100%", padding: "13px", borderRadius: 12, border: "none", background: "var(--fill-inset)", color: "var(--text-disabled)", fontSize: 14, fontWeight: 700, fontFamily: "inherit" }}
        >
          {selected.length < MIN_POLL_VOTES
            ? `Selecione mais ${MIN_POLL_VOTES - selected.length} álbum${MIN_POLL_VOTES - selected.length !== 1 ? "s" : ""}`
            : `Votar em ${selected.length} álbuns →`}
        </button>
      ) : null}
    </div>
  );
}

function Phase3({ round }: { round: ClubeRoundData }) {
  const winnerIds = new Set(round.winners.map((w) => w.nominationId));
  const others = round.nominations.filter((a) => !winnerIds.has(a.id));

  return (
    <div>
      <div style={{ textAlign: "center", marginBottom: 32 }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 6, background: "var(--accent-tint)", color: "var(--accent)", borderRadius: 100, padding: "5px 14px", fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase", marginBottom: 16 }}>
          Escolhidos da semana
        </div>
        <h2 style={{ fontSize: 26, fontWeight: 800, letterSpacing: "-0.03em", color: "var(--text)", margin: 0 }}>{round.theme}</h2>
      </div>

      {round.winners.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 16, marginBottom: 40 }}>
          {round.winners.map((album, idx) => (
            <WinnerCard key={album.nominationId} album={album} idx={idx} revealed={round.identitiesRevealed} />
          ))}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: 32, color: "var(--text-muted)", marginBottom: 32 }}>Resultado em breve…</div>
      )}

      {others.length > 0 && (
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 14 }}>Outras indicações</div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(96px,1fr))", gap: 10 }}>
            {others.map((a) => (
              <div key={a.id} style={{ background: "var(--surface)", border: "1px solid var(--divider)", borderRadius: 12, overflow: "hidden" }}>
                <div style={{ width: "100%", aspectRatio: "1/1", background: a.coverUrl ? undefined : `hsl(${albumHue(a.title)},45%,55%)`, position: "relative" }}>
                  {a.coverUrl ? <img src={a.coverUrl} alt={a.title} style={{ width: "100%", height: "100%", objectFit: "cover" }} /> : <div style={{ width: "100%", height: "100%", display: "grid", placeItems: "center", color: "white", fontSize: 30, fontWeight: 800 }}>{a.title[0]}</div>}
                </div>
                <div style={{ padding: "8px 10px 10px" }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.title}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.artist}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function Phase4({ round, isMobile }: { round: ClubeRoundData; isMobile?: boolean }) {
  const [countdown, setCountdown] = useState("");

  useEffect(() => {
    if (!round.nextRoundStartsAt) return;
    const target = new Date(round.nextRoundStartsAt);
    const tick = () => setCountdown(formatCountdown(target));
    tick();
    const id = setInterval(tick, 30_000);
    return () => clearInterval(id);
  }, [round.nextRoundStartsAt]);

  return (
    <div>
      <div style={{ background: "linear-gradient(135deg,#1D1D1F 0%,#3A3A3C 100%)", borderRadius: 16, padding: isMobile ? "16px 18px" : "22px 24px", marginBottom: 28, color: "white" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", opacity: 0.5, marginBottom: 6 }}>
          {round.identitiesRevealed ? "Rodada encerrada" : "Período de escuta"} · {round.theme}
        </div>
        <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.03em", marginBottom: 10 }}>
          {round.identitiesRevealed ? "Resultados finais da rodada" : "Hora de ouvir os escolhidos!"}
        </div>
        {round.identitiesRevealed ? (
          <div style={{ fontSize: 13, opacity: 0.75 }}>Notas CriticsFM e indicadores revelados</div>
        ) : round.listeningDeadline ? (
          <div style={{ fontSize: 13, opacity: 0.6 }}>
            Escuta até {round.listeningDeadline}
            {round.revealsAt && ` · Revelação em ${round.revealsAt}`}
          </div>
        ) : null}
      </div>

      {round.winners.length > 0 ? (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: 16, marginBottom: 28 }}>
          {round.winners.map((album, idx) => (
            <WinnerCard key={album.nominationId} album={album} idx={idx} revealed={round.identitiesRevealed} />
          ))}
        </div>
      ) : (
        <div style={{ textAlign: "center", padding: 32, color: "var(--text-muted)" }}>Aguardando definição dos escolhidos…</div>
      )}

      {round.nextRoundStartsAt && (
        <div style={{ background: "var(--fill-inset)", border: "1px solid var(--divider)", borderRadius: 16, padding: "18px 20px", display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 40, height: 40, borderRadius: 10, background: "var(--accent-tint)", display: "grid", placeItems: "center", flexShrink: 0 }}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round">
              <circle cx="12" cy="12" r="10" />
              <polyline points="12 6 12 12 16 14" />
            </svg>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 2 }}>
              Próxima rodada {countdown ? `em ${countdown}` : ""}
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
              {round.nextRoundCountdown ? `Inscrições em ${round.nextRoundCountdown}` : "O tema ainda não foi revelado. Fique de olho!"}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function ClubeDoAlbum({ round }: { round: ClubeRoundData | null }) {
  const isMobile = useIsMobile();

  if (!round) {
    return (
      <div style={{ marginBottom: 40, background: "var(--surface)", border: "1px solid var(--divider)", borderRadius: 20, padding: isMobile ? "32px 20px" : "48px 28px", textAlign: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>Clube do Álbum</div>
        <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 16 }}>Nenhuma rodada ativa no momento.</div>
        <Link href="/criticsfm/clube/historico" style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)", textDecoration: "none" }}>
          Ver histórico de rodadas →
        </Link>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: 40 }}>
      <div style={{ background: "var(--surface)", border: "1px solid var(--divider)", borderRadius: 20, padding: isMobile ? "20px 16px" : "28px", boxShadow: "0 1px 4px rgba(0,0,0,0.04)" }}>
        <ClubHeader round={round} isMobile={isMobile} />
        <PhaseSteps current={round.phase} isMobile={isMobile} />
        <HowItWorks />
        {round.phase === "0" && <Phase0 round={round} isMobile={isMobile} />}
        {round.phase === "1" && <Phase1 round={round} isMobile={isMobile} />}
        {round.phase === "2" && <Phase2 round={round} isMobile={isMobile} />}
        {round.phase === "3" && <Phase3 round={round} />}
        {round.phase === "4" && <Phase4 round={round} isMobile={isMobile} />}
      </div>
    </div>
  );
}
