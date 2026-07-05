"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Check, Crown, ExternalLink, History, Loader2, Star } from "lucide-react";
import { Shell } from "@/components/layout/Shell";
import { Cover } from "@/components/ui/Cover";
import { Avatar } from "@/components/ui/Avatar";
import type {
  SpotlightCategory,
  WeeklyPollOptionView,
  WeeklyPollView,
} from "@/lib/weekly-spotlight-poll";

type PollResponse = {
  poll: WeeklyPollView | null;
  loggedIn: boolean;
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

function OptionCard({
  option,
  color,
  loggedIn,
  pollOpen,
  onToggle,
  pending,
}: {
  option: WeeklyPollOptionView;
  color: string;
  loggedIn: boolean;
  pollOpen: boolean;
  onToggle: (optionId: string) => void;
  pending: boolean;
}) {
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
        alignItems: "flex-start",
      }}
    >
      <Cover
        cover={option.song.cover}
        song={{
          title: option.song.title,
          artist: option.song.artist,
          imageUrl: option.song.cover.imageUrl ?? undefined,
        }}
        size={72}
        rounded={12}
      />
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

        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, marginTop: 10 }}>
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            Indicada por
          </span>
          {option.nominators.map((n) => (
            <Link
              key={n.id}
              href={`/profile/${encodeURIComponent(n.handle)}`}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                textDecoration: "none",
                color: "var(--text)",
                fontSize: 12,
                fontWeight: 600,
              }}
            >
              <Avatar user={{ name: n.name, avatar: n.avatarColor }} imageUrl={n.image} size={20} />
              @{n.handle}
            </Link>
          ))}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 12, flexWrap: "wrap" }}>
          {pollOpen && (
            loggedIn ? (
              <button
                onClick={() => onToggle(option.id)}
                disabled={pending}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "8px 14px",
                  borderRadius: 999,
                  border: option.votedByMe ? "none" : "1px solid var(--divider)",
                  background: option.votedByMe ? color : "transparent",
                  color: option.votedByMe ? "#fff" : "var(--text)",
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: pending ? "wait" : "pointer",
                }}
              >
                {pending ? <Loader2 size={14} className="animate-spin" /> : option.votedByMe ? <Check size={14} /> : null}
                {option.votedByMe ? "Votado" : "Votar"}
              </button>
            ) : (
              <Link
                href="/login"
                style={{
                  fontSize: 13,
                  fontWeight: 600,
                  color,
                  textDecoration: "none",
                }}
              >
                Entre para votar →
              </Link>
            )
          )}
          <span style={{ fontSize: 12, color: "var(--text-muted)" }}>
            {option.voteCount} {option.voteCount === 1 ? "voto" : "votos"}
          </span>
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
              }}
            >
              <ExternalLink size={13} />
              Ouvir
            </a>
          )}
        </div>
      </div>
    </div>
  );
}

export function VotacaoDaSemanaClient() {
  const [data, setData] = useState<PollResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/weekly-poll", { cache: "no-store" });
      if (!res.ok) throw new Error();
      setData((await res.json()) as PollResponse);
    } catch {
      setError("Não foi possível carregar a votação. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleVote = useCallback(
    async (optionId: string) => {
      if (!data?.poll || pendingId) return;
      setPendingId(optionId);
      setError(null);
      try {
        const res = await fetch("/api/weekly-poll/vote", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ optionId }),
        });
        const json = (await res.json()) as { voted?: boolean; voteCount?: number; error?: string };
        if (!res.ok) throw new Error(json.error || "Falha ao registrar o voto.");
        setData((prev) =>
          prev?.poll
            ? {
                ...prev,
                poll: {
                  ...prev.poll,
                  options: prev.poll.options.map((o) =>
                    o.id === optionId
                      ? { ...o, votedByMe: Boolean(json.voted), voteCount: json.voteCount ?? o.voteCount }
                      : o,
                  ),
                },
              }
            : prev,
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Falha ao registrar o voto.");
      } finally {
        setPendingId(null);
      }
    },
    [data, pendingId],
  );

  const poll = data?.poll ?? null;
  const pollOpen = poll?.status === "open";

  return (
    <Shell
      title="Votação da Semana"
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
          Ainda não há votação aberta. A enquete abre todo domingo às 23:59 com as músicas indicadas
          como Destaque e Flashback nas paradas pessoais da semana.
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
            {pollOpen ? (
              <>
                Vote em quantas músicas quiser — em cada categoria, a mais votada vira o card da{" "}
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

          {(Object.keys(CATEGORY_META) as SpotlightCategory[]).map((category) => {
            const meta = CATEGORY_META[category];
            const options = poll.options.filter((o) => o.category === category);
            return (
              <section key={category} style={{ marginBottom: 40 }}>
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
                  <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
                    Nenhuma indicação nesta categoria esta semana.
                  </div>
                ) : (
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                      gap: 14,
                    }}
                  >
                    {options.map((option) => (
                      <OptionCard
                        key={option.id}
                        option={option}
                        color={meta.color}
                        loggedIn={Boolean(data?.loggedIn)}
                        pollOpen={pollOpen}
                        onToggle={toggleVote}
                        pending={pendingId === option.id}
                      />
                    ))}
                  </div>
                )}
              </section>
            );
          })}
        </>
      )}
    </Shell>
  );
}
