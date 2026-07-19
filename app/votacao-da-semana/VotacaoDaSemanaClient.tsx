"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Crown, ExternalLink, History, Loader2, Music, Star } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useMobileReorder } from "@/hooks/useMobileReorder";
import {
  MobileReorderPositionSheet,
  MobileReorderToolbar,
} from "@/components/mobile-reorder";
import { MobileReorderRowControls } from "@/components/mobile-reorder/MobileReorderRowControls";
import { TrackCover, RankBadge, CheckIcon } from "@/components/push/PushAtoms";
import { pushPoints } from "@/lib/push-scoring";
import type {
  SpotlightCategory,
  WeeklyPollOptionView,
  WeeklyPollView,
} from "@/lib/weekly-spotlight-poll";

type PollResponse = {
  poll: WeeklyPollView | null;
  loggedIn: boolean;
  isMember?: boolean;
  community?: { slug: string; name: string };
};

export type VotacaoDaSemanaClientProps = {
  /** Padrão: enquete global. Em comunidade, só membros votam. */
  scope?: "global" | "community";
  communitySlug?: string;
  communityName?: string;
};

const CATEGORY_META: Record<
  SpotlightCategory,
  { title: string; description: string; color: string; icon: React.ReactNode }
> = {
  destaque: {
    title: "Melhor da Semana",
    description: "As músicas indicadas como Destaque nas paradas pessoais desta semana.",
    color: "#FA243C",
    icon: <Star size={18} />,
  },
  flashback: {
    title: "Flashback da Semana",
    description: "As músicas indicadas como Flashback nas paradas pessoais desta semana.",
    color: "#7C3AED",
    icon: <History size={18} />,
  },
};

function NominatorsRow({ nominators }: { nominators: WeeklyPollOptionView["nominators"] }) {
  if (nominators.length === 0) return null;
  return (
    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6, marginTop: 6 }}>
      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Indicada por</span>
      {nominators.map((n) => (
        <Link
          key={n.id}
          href={`/profile/${encodeURIComponent(n.handle)}`}
          style={{ fontSize: 11, fontWeight: 600, color: "var(--text)", textDecoration: "none" }}
        >
          @{n.handle}
        </Link>
      ))}
    </div>
  );
}

function ResultRow({ option, color, rank }: { option: WeeklyPollOptionView; color: string; rank: number }) {
  const spotifyUrl =
    option.song.spotifyUrl ??
    (option.song.spotifyId ? `https://open.spotify.com/track/${option.song.spotifyId}` : null);

  return (
    <div
      style={{
        background: "var(--surface)",
        border: option.isWinner ? `2px solid ${color}` : "1px solid var(--divider)",
        borderRadius: 16,
        padding: 16,
        display: "flex",
        gap: 14,
        alignItems: "center",
      }}
    >
      <RankBadge pos={rank} />
      <TrackCover imageUrl={option.song.cover.imageUrl ?? null} size={56} />
      <div style={{ flex: 1, minWidth: 0 }}>
        {option.isWinner && (
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.06em",
              textTransform: "uppercase",
              color,
              marginBottom: 4,
            }}
          >
            <Crown size={13} /> Vencedora
          </div>
        )}
        <div style={{ fontSize: 15, fontWeight: 700, lineHeight: 1.35 }}>{option.song.title}</div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 2 }}>{option.song.artist}</div>
        <NominatorsRow nominators={option.nominators} />
        {spotifyUrl && (
          <a
            href={spotifyUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 5,
              fontSize: 12,
              fontWeight: 600,
              color: "#1DB954",
              textDecoration: "none",
              marginTop: 8,
            }}
          >
            <ExternalLink size={13} />
            Ouvir
          </a>
        )}
      </div>
      <div style={{ textAlign: "center", flexShrink: 0 }}>
        <div style={{ fontSize: 20, fontWeight: 900, color: "var(--text)", lineHeight: 1 }}>{option.totalPoints ?? 0}</div>
        <div style={{ fontSize: 9, fontWeight: 600, color: "var(--text-muted)", letterSpacing: ".05em", marginTop: 2 }}>PTS</div>
      </div>
    </div>
  );
}

function CategoryRanking({
  poll,
  category,
  loggedIn,
  canVote,
  voteUrl,
  onSaved,
}: {
  poll: WeeklyPollView;
  category: SpotlightCategory;
  loggedIn: boolean;
  canVote: boolean;
  voteUrl: string;
  onSaved: () => void;
}) {
  const meta = CATEGORY_META[category];
  const isMobile = useIsMobile();
  const options = poll.options.filter((o) => o.category === category);
  const myOption = options.find((o) => o.excludedForMe) ?? null;
  const toRank = options.filter((o) => !o.excludedForMe);
  const pollOpen = poll.status === "open";

  const initialOrder = useCallback((): WeeklyPollOptionView[] => {
    const ranked = toRank.some((o) => o.myPosition !== null);
    if (ranked) {
      return [...toRank].sort((a, b) => (a.myPosition ?? 999) - (b.myPosition ?? 999));
    }
    return toRank;
  }, [toRank]);

  const [ranking, setRanking] = useState<WeeklyPollOptionView[]>(initialOrder);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dragItem = useRef<number | null>(null);

  useEffect(() => {
    setRanking(initialOrder());
    setSaved(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poll.id, poll.status, category]);

  const mobileReorder = useMobileReorder({
    items: ranking,
    onChange: (next) => {
      setRanking(next);
      setSaved(false);
    },
    getItemLabel: (item) => item.song.title,
  });

  const hasVoted = toRank.some((o) => o.myPosition !== null);
  const total = toRank.length;

  function handleDragStart(idx: number) {
    dragItem.current = idx;
  }
  function handleDragEnter(idx: number) {
    if (dragItem.current === null || dragItem.current === idx) return;
    setRanking((prev) => {
      const next = [...prev];
      const [moved] = next.splice(dragItem.current!, 1);
      next.splice(idx, 0, moved);
      dragItem.current = idx;
      return next;
    });
    setSaved(false);
  }
  function handleDragEnd() {
    dragItem.current = null;
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    const positions = ranking.map((o, i) => ({ optionId: o.id, position: i + 1 }));
    try {
      const res = await fetch(voteUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ category, positions }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setError(data.error ?? "Erro ao salvar");
        return;
      }
      setSaved(true);
      onSaved();
    } catch {
      setError("Erro de conexão.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section style={{ marginBottom: 40 }}>
      <h2
        style={{
          display: "flex",
          alignItems: "center",
          gap: 8,
          fontSize: 18,
          fontWeight: 700,
          letterSpacing: "-0.025em",
          marginBottom: 6,
          color: "var(--text)",
        }}
      >
        <span style={{ color: meta.color, display: "inline-flex" }}>{meta.icon}</span>
        {meta.title}
      </h2>
      <p style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 16 }}>{meta.description}</p>

      {options.length === 0 ? (
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Nenhuma indicação nesta categoria esta semana.</div>
      ) : !pollOpen ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {options.map((option, i) => (
            <ResultRow key={option.id} option={option} color={meta.color} rank={i + 1} />
          ))}
        </div>
      ) : !loggedIn ? (
        <>
          <div style={{ fontSize: 13, color: "var(--text-muted)", marginBottom: 12 }}>
            <Link href="/login" style={{ color: meta.color, fontWeight: 600, textDecoration: "none" }}>
              Entre para ranquear →
            </Link>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {toRank.map((sub) => (
              <div
                key={sub.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 12px",
                  borderRadius: 13,
                  background: "var(--surface)",
                  border: "1px solid var(--divider)",
                }}
              >
                <TrackCover imageUrl={sub.song.cover.imageUrl ?? null} size={38} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700 }}>{sub.song.title}</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{sub.song.artist}</div>
                </div>
              </div>
            ))}
          </div>
        </>
      ) : !canVote ? (
        <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.6 }}>
          Só membros da comunidade podem votar nesta enquete. Entre na comunidade para participar.
        </div>
      ) : total === 0 ? (
        <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
          Só há a sua própria indicação nesta categoria — nada para ranquear.
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {myOption && (
            <div style={{ marginBottom: 16 }}>
              <div
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  color: "var(--text-muted)",
                  letterSpacing: ".07em",
                  textTransform: "uppercase" as const,
                  marginBottom: 8,
                }}
              >
                Sua indicação
              </div>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "9px 12px",
                  borderRadius: 13,
                  background: "color-mix(in srgb, var(--accent) 6%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--accent) 18%, transparent)",
                }}
              >
                <div
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 7,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    background: "color-mix(in srgb, var(--accent) 18%, transparent)",
                    flexShrink: 0,
                  }}
                >
                  <Music size={12} color="var(--accent)" />
                </div>
                <TrackCover imageUrl={myOption.song.cover.imageUrl ?? null} size={38} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12, fontWeight: 700, color: "var(--accent)" }}>{myOption.song.title}</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{myOption.song.artist}</div>
                </div>
                <span style={{ fontSize: 10, color: "var(--accent)", fontWeight: 700, flexShrink: 0 }}>Fora do ranking</span>
              </div>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
            <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
              {!isMobile && "Arraste para ordenar · "}#1 = 20 pts · #{total} = 1 pt
              {hasVoted && <span style={{ color: "#10b981", fontWeight: 600 }}> · ✓ Ranking salvo</span>}
            </span>
          </div>

          {isMobile && ranking.length > 0 ? (
            <div style={{ position: "relative", marginBottom: 16, borderRadius: 13, border: "1px solid var(--divider)", overflow: "hidden" }}>
              <MobileReorderToolbar
                mode={mobileReorder.mode}
                onModeChange={mobileReorder.setMode}
                hint={mobileReorder.hint}
                showSwapBanner={mobileReorder.showSwapBanner}
                swapBannerTitle={mobileReorder.selectedTitle ?? undefined}
                onCancelSwap={mobileReorder.cancelSelection}
              />
              {ranking.map((option, idx) => {
                const pts = pushPoints(idx + 1, total);
                const rowProps = mobileReorder.getRowProps(idx);
                return (
                  <div
                    key={option.id}
                    onClick={rowProps.onRowClick}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "10px 12px",
                      borderBottom: "1px solid var(--divider)",
                      background: "var(--surface)",
                      userSelect: "none",
                      WebkitTapHighlightColor: "transparent",
                      ...rowProps.rowStyle,
                    }}
                  >
                    <RankBadge pos={idx + 1} />
                    <TrackCover imageUrl={option.song.cover.imageUrl ?? null} size={38} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {option.song.title}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {option.song.artist}
                      </div>
                    </div>
                    <div style={{ textAlign: "center", flexShrink: 0, minWidth: 34 }}>
                      <div style={{ fontSize: 17, fontWeight: 900, lineHeight: 1, letterSpacing: "-.02em" }}>{pts}</div>
                      <div style={{ fontSize: 8, fontWeight: 600, color: "var(--text-muted)", letterSpacing: ".05em", marginTop: 1 }}>PTS</div>
                    </div>
                    <MobileReorderRowControls
                      mode={mobileReorder.mode}
                      canMoveUp={rowProps.canMoveUp}
                      canMoveDown={rowProps.canMoveDown}
                      onMoveUp={rowProps.onMoveUp}
                      onMoveDown={rowProps.onMoveDown}
                      isSelected={rowProps.isSelected}
                      isSwapTarget={rowProps.isSwapTarget}
                    />
                  </div>
                );
              })}
              {mobileReorder.showPositionSheet && mobileReorder.editTargetTitle ? (
                <MobileReorderPositionSheet
                  title={mobileReorder.editTargetTitle}
                  currentPosition={(mobileReorder.editTargetIndex ?? 0) + 1}
                  maxPosition={mobileReorder.itemCount}
                  onConfirm={mobileReorder.confirmPosition}
                  onClose={mobileReorder.closePositionSheet}
                />
              ) : null}
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
              {ranking.map((option, idx) => {
                const pts = pushPoints(idx + 1, total);
                return (
                  <div
                    key={option.id}
                    draggable
                    onDragStart={() => handleDragStart(idx)}
                    onDragEnter={() => handleDragEnter(idx)}
                    onDragEnd={handleDragEnd}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "9px 12px",
                      borderRadius: 13,
                      background: "var(--surface)",
                      border: "1.5px solid var(--divider)",
                      cursor: "grab",
                      userSelect: "none",
                      boxShadow: "0 1px 2px rgba(0,0,0,.04)",
                    }}
                  >
                    <RankBadge pos={idx + 1} />
                    <TrackCover imageUrl={option.song.cover.imageUrl ?? null} size={38} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {option.song.title}
                      </div>
                      <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {option.song.artist}
                      </div>
                    </div>
                    <div style={{ textAlign: "center" as const, flexShrink: 0, minWidth: 34 }}>
                      <div style={{ fontSize: 17, fontWeight: 900, lineHeight: 1, letterSpacing: "-.02em" }}>{pts}</div>
                      <div style={{ fontSize: 8, fontWeight: 600, color: "var(--text-muted)", letterSpacing: ".05em", marginTop: 1 }}>PTS</div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {error && (
            <div style={{ padding: "12px 14px", borderRadius: 10, background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: 13, marginBottom: 12 }}>
              {error}
            </div>
          )}

          <button
            type="button"
            onClick={saved ? undefined : handleSave}
            disabled={saving}
            style={{
              padding: "14px",
              borderRadius: 14,
              border: "none",
              background: saved ? "#10b981" : meta.color,
              color: "white",
              fontSize: 15,
              fontWeight: 700,
              cursor: saving || saved ? "default" : "pointer",
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              transition: "background 200ms",
            }}
          >
            {saved ? (
              <>
                <div style={{ width: 20, height: 20, borderRadius: 10, background: "rgba(255,255,255,.25)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <CheckIcon size={10} />
                </div>
                Ranking enviado com sucesso!
              </>
            ) : saving ? (
              "Salvando…"
            ) : (
              "Confirmar meu ranking"
            )}
          </button>
        </div>
      )}
    </section>
  );
}

export function VotacaoDaSemanaClient({
  scope = "global",
  communitySlug,
  communityName,
}: VotacaoDaSemanaClientProps = {}) {
  const isCommunity = scope === "community" && Boolean(communitySlug);
  const fetchUrl = isCommunity
    ? `/api/communities/${encodeURIComponent(communitySlug!)}/weekly-poll`
    : "/api/weekly-poll";
  const voteUrl = isCommunity
    ? `/api/communities/${encodeURIComponent(communitySlug!)}/weekly-poll/vote`
    : "/api/weekly-poll/vote";
  const communityHref = isCommunity ? `/community/${encodeURIComponent(communitySlug!)}` : null;

  const [data, setData] = useState<PollResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(fetchUrl, { cache: "no-store" });
      if (!res.ok) throw new Error();
      setData((await res.json()) as PollResponse);
    } catch {
      setError("Não foi possível carregar a votação. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [fetchUrl]);

  useEffect(() => {
    void load();
  }, [load]);

  const poll = data?.poll ?? null;
  const pollOpen = poll?.status === "open";
  const resolvedName = data?.community?.name ?? communityName ?? null;
  const canVote = isCommunity ? Boolean(data?.isMember) : true;
  const title = isCommunity
    ? `Votação · ${resolvedName ?? "Comunidade"}`
    : "Votação da Semana";

  return (
    <Shell
      title={title}
      subtitle={poll ? `${poll.weekLabel} · ${poll.dateRange}` : "Melhor da Semana e Flashback da Semana"}
    >
      {loading ? (
        <div style={{ display: "flex", alignItems: "center", gap: 8, color: "var(--text-muted)", fontSize: 14 }}>
          <Loader2 size={16} className="animate-spin" /> Carregando votação…
        </div>
      ) : !poll ? (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--divider)",
            borderRadius: 16,
            padding: 28,
            fontSize: 14,
            color: "var(--text-muted)",
            lineHeight: 1.7,
          }}
        >
          {isCommunity ? (
            <>
              Ainda não há votação aberta nesta comunidade. A enquete abre todo domingo às 23:59 com as
              músicas indicadas como Destaque e Flashback nas paradas pessoais dos membros.
              {communityHref ? (
                <>
                  {" "}
                  <Link href={communityHref} style={{ color: "#FA243C", fontWeight: 600, textDecoration: "none" }}>
                    Voltar à comunidade →
                  </Link>
                </>
              ) : null}
            </>
          ) : (
            <>
              Ainda não há votação aberta. A enquete abre todo domingo às 23:59 com as músicas indicadas
              como Destaque e Flashback nas paradas pessoais da semana.
            </>
          )}
        </div>
      ) : (
        <>
          <div
            style={{
              background: "var(--surface)",
              border: "1px solid var(--divider)",
              borderRadius: 16,
              padding: "16px 20px",
              marginBottom: 28,
              fontSize: 14,
              lineHeight: 1.7,
              color: "var(--text-muted)",
            }}
          >
            {isCommunity ? (
              pollOpen ? (
                <>
                  Arraste para ordenar sua preferência em cada categoria — a 1ª posição vale 20 pontos, a
                  última vale 1. Só membros de {resolvedName ?? "esta comunidade"} podem votar. A votação
                  encerra na terça de madrugada.
                </>
              ) : (
                <>A votação desta semana em {resolvedName ?? "esta comunidade"} já foi encerrada. As vencedoras estão destacadas abaixo.</>
              )
            ) : pollOpen ? (
              <>
                Arraste para ordenar sua preferência em cada categoria — a 1ª posição vale 20 pontos, a
                última vale 1. A música com mais pontos no total vence e vira o card da{" "}
                <Link href="/global/100" style={{ color: "#FA243C", fontWeight: 600, textDecoration: "none" }}>
                  Parada Global
                </Link>{" "}
                de terça-feira. A votação encerra na terça de madrugada.
              </>
            ) : (
              <>
                A votação desta semana já foi encerrada. As vencedoras estão destacadas abaixo e nos cards da{" "}
                <Link href="/global/100" style={{ color: "#FA243C", fontWeight: 600, textDecoration: "none" }}>
                  Parada Global
                </Link>
                .
              </>
            )}
          </div>

          {error && (
            <div style={{ color: "#FA243C", fontSize: 13, fontWeight: 600, marginBottom: 16 }}>{error}</div>
          )}

          {(Object.keys(CATEGORY_META) as SpotlightCategory[]).map((category) => (
            <CategoryRanking
              key={category}
              poll={poll}
              category={category}
              loggedIn={Boolean(data?.loggedIn)}
              canVote={canVote}
              voteUrl={voteUrl}
              onSaved={() => void load()}
            />
          ))}
        </>
      )}
    </Shell>
  );
}
