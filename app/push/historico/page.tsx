import Link from "next/link";
import { Shell } from "@/components/layout/Shell";
import { prisma } from "@/lib/prisma";
import { computePushRoundScores } from "@/lib/push-scoring";
import { pushRoundTitle } from "@/lib/push-format";
import { ExternalLink, Trophy } from "lucide-react";
import { PushNav } from "../PushNav";

export const revalidate = 60;

async function getHistory() {
  const rounds = await prisma.pushRound.findMany({
    where: { phase: "RESULT" },
    orderBy: { number: "desc" },
    include: {
      submissions: {
        include: {
          user: { select: { handle: true, name: true } },
          song: { select: { title: true, artist: true, spotifyUrl: true } },
        },
      },
      votes: { select: { userId: true, submissionId: true, position: true } },
    },
  });

  return rounds.map((round) => {
    const totals = computePushRoundScores(
      round.submissions.map((s) => ({ id: s.id, userId: s.userId })),
      round.votes,
    );
    const sorted = round.submissions
      .map((s) => ({ ...s, totalPoints: totals.get(s.id) ?? 0 }))
      .sort((a, b) => b.totalPoints - a.totalPoints);

    return {
      id: round.id,
      number: round.number,
      title: round.title,
      season: round.season,
      spotifyPlaylistId: round.spotifyPlaylistId,
      createdAt: round.createdAt.toISOString(),
      results: sorted.map((s, i) => ({
        rank: i + 1,
        userHandle: s.user.handle,
        userName: s.user.name,
        totalPoints: s.totalPoints,
        song: { title: s.song.title, artist: s.song.artist, spotifyUrl: s.song.spotifyUrl },
      })),
    };
  });
}

export default async function PushHistoricoPage() {
  const rounds = await getHistory();

  return (
    <Shell
      title="Push · Histórico"
      subtitle="Todas as rodadas concluídas"
      headerRight={
        <Link href="/push" style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", textDecoration: "none" }}>
          ← Rodada atual
        </Link>
      }
    >
      <div style={{ maxWidth: 680, marginBottom: 24 }}>
        <PushNav />
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 32, maxWidth: 680 }}>
        {rounds.length === 0 && (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
            <Trophy size={48} style={{ opacity: 0.2, marginBottom: 16, display: "block", margin: "0 auto 16px" }} />
            Nenhuma rodada concluída ainda. Fique de olho!
          </div>
        )}

        {rounds.map((round) => (
          <div
            key={round.id}
            style={{
              borderRadius: 16,
              background: "var(--surface)",
              border: "1px solid var(--divider)",
              overflow: "hidden",
            }}
          >
            {/* Header */}
            <div style={{ padding: "18px 22px", borderBottom: "1px solid var(--divider)", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>
                  Rodada #{round.number} · Temporada {round.season}
                </div>
                <h3 style={{ margin: 0, fontSize: 18, fontWeight: 700, letterSpacing: "-0.02em", color: "var(--text)" }}>
                  {pushRoundTitle(round.season, round.number)}
                </h3>
              </div>
              {round.spotifyPlaylistId && (
                <a
                  href={`https://open.spotify.com/playlist/${round.spotifyPlaylistId}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    padding: "7px 14px",
                    borderRadius: 100,
                    background: "#1ed760",
                    color: "white",
                    fontSize: 12,
                    fontWeight: 700,
                    textDecoration: "none",
                    flexShrink: 0,
                  }}
                >
                  <ExternalLink size={12} />
                  Playlist
                </a>
              )}
            </div>

            {/* Results */}
            <div style={{ padding: "12px 0" }}>
              {round.results.map((r) => (
                <div
                  key={r.rank}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "8px 22px",
                    background: r.rank === 1 ? "rgba(245,158,11,0.06)" : "transparent",
                  }}
                >
                  <div style={{ width: 28, textAlign: "center", flexShrink: 0, fontSize: 15, fontWeight: 700, color: r.rank <= 3 ? "var(--accent)" : "var(--text-muted)" }}>
                    {r.rank <= 3 ? ["🥇", "🥈", "🥉"][r.rank - 1] : r.rank}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {r.song.title}
                    </div>
                    <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                      {r.song.artist}
                      <span style={{ margin: "0 4px" }}>·</span>
                      <Link href={`/profile/${r.userHandle}`} style={{ color: "inherit", textDecoration: "none" }}>
                        @{r.userHandle}
                      </Link>
                    </div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", flexShrink: 0 }}>
                    {r.totalPoints} pts
                  </div>
                  {r.song.spotifyUrl && (
                    <a href={r.song.spotifyUrl} target="_blank" rel="noopener noreferrer">
                      <ExternalLink size={13} color="var(--text-muted)" />
                    </a>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Shell>
  );
}
