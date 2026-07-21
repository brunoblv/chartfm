"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { CopaArtistAvatar } from "./CopaArtistAvatar";
import { useTranslations } from "@/hooks/useTranslations";

type TFn = ReturnType<typeof useTranslations>["t"];

type SimpleFixture = {
  id: string;
  phase: string;
  groupLetter: string | null;
  round: number | null;
  matchIndex?: number;
  status: string;
  votesA: number;
  votesB: number;
  goalsA: number;
  goalsB: number;
  myVote: "A" | "B" | null;
  singleAName: string;
  singleBName: string;
  singleACover?: string | null;
  singleBCover?: string | null;
  artistA: { id: string; artistName: string; artistImage: string | null; artistColor: string; artistInitials: string; ownerId: string; groupLetter: string };
  artistB: { id: string; artistName: string; artistImage: string | null; artistColor: string; artistInitials: string; ownerId: string; groupLetter: string };
};

type Props = {
  copa: { id: string; name: string; year: number; status: string; maxParticipants: number; artistsPerUser: number; isParticipant: boolean; participants: { userId: string; name: string; handle: string; avatarColor: string }[] };
  userId: string | null;
  liveFixture: SimpleFixture | null;
  liveCount: number;
  recentDone: SimpleFixture[];
  upcoming: SimpleFixture | null;
  myArtists: { id: string; artistName: string; artistImage: string | null; artistColor: string; artistInitials: string; groupLetter: string; standingRank: number }[];
};

function getFixturePhaseLabels(t: TFn): Record<string, string> {
  return {
    R32: t("copa.phaseR32"),
    R16: t("copa.phaseR16"),
    QF: t("copa.phaseQF"),
    SF: t("copa.phaseSF"),
    FINAL: t("copa.phaseFinal"),
    THIRD_PLACE: t("copa.phaseThirdPlace"),
  };
}

function fixtureContextLabel(f: SimpleFixture, t: TFn): string {
  if (f.phase === "GROUP") return t("copa.groupRoundLabel", { letter: f.groupLetter ?? "", round: f.round ?? "" });
  return getFixturePhaseLabels(t)[f.phase] ?? f.phase;
}

function livePhaseSummary(liveFixture: SimpleFixture | null, liveCount: number, t: TFn): string | null {
  if (!liveFixture || liveCount === 0) return null;
  const phase = getFixturePhaseLabels(t)[liveFixture.phase] ?? liveFixture.phase;
  if (liveCount === 1) return t("copa.homeLivePhaseSingle", { phase });
  return t("copa.homeLivePhaseMulti", { count: liveCount, phase });
}

function LiveDot() {
  return (
    <span
      style={{
        display: "inline-block",
        width: 7,
        height: 7,
        borderRadius: "50%",
        // ✅ FIX: var(--accent) em vez de #FA243C
        background: "var(--accent)",
        animation: "pulse 1.4s ease-in-out infinite",
        marginRight: 5,
      }}
    />
  );
}

function Badge({ children, variant }: { children: React.ReactNode; variant: "live" | "done" | "next" }) {
  const styles: Record<string, React.CSSProperties> = {
    // ✅ FIX: live badge usa var(--surface) + var(--accent) em vez de rgba vermelha
    live: { background: "var(--surface)", color: "var(--accent)" },
    done: { background: "var(--fill-inset)", color: "var(--text-muted)" },
    next: { background: "var(--fill-inset)", color: "var(--text-disabled)" },
  };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.05em",
        textTransform: "uppercase",
        padding: "3px 8px",
        borderRadius: 99,
        ...styles[variant],
      }}
    >
      {variant === "live" && <LiveDot />}
      {children}
    </span>
  );
}

function ScoreRow({ f }: { f: SimpleFixture }) {
  const router = useRouter();
  const { t } = useTranslations();
  return (
    <div
      onClick={() => router.push(`/copa/jogo/${f.id}`)}
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 14px",
        borderRadius: 10,
        background: "var(--surface)",
        // ✅ FIX: borda sempre var(--divider), sem linha vermelha
        border: "1px solid var(--divider)",
        cursor: "pointer",
        marginBottom: 6,
      }}
    >
      <CopaArtistAvatar {...f.artistA} coverUrl={f.singleACover} size={26} />
      <span style={{ flex: 1, fontSize: 13, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.artistA.artistName}</span>
      <span style={{ fontSize: 14, fontWeight: 800, padding: "0 8px", flexShrink: 0 }}>
        {f.goalsA}–{f.goalsB}
      </span>
      <span style={{ flex: 1, fontSize: 13, fontWeight: 700, textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{f.artistB.artistName}</span>
      <CopaArtistAvatar {...f.artistB} coverUrl={f.singleBCover} size={26} />
      {f.status === "LIVE" ? <Badge variant="live">{t("copa.liveBadge")}</Badge> : <Badge variant="done">R{f.round}</Badge>}
    </div>
  );
}

export function CopaHomeClient({ copa, userId, liveFixture, liveCount, recentDone, upcoming, myArtists }: Props) {
  const router = useRouter();
  const { t } = useTranslations();
  const [joining, setJoining] = useState(false);

  const isFull = copa.participants.length >= copa.maxParticipants;

  async function join() {
    if (joining) return;
    if (!userId) {
      router.push("/login");
      return;
    }
    setJoining(true);
    try {
      const res = await fetch(`/api/copa/${copa.id}/join`, { method: "POST" });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        alert(err.error ?? t("copa.homeJoinError"));
        return;
      }
      router.push("/copa/meu-time");
    } finally {
      setJoining(false);
    }
  }

  const phaseLabel: Record<string, string> = {
    REGISTRATION: t("copa.homeStatusRegistration"),
    GROUP_STAGE: t("copa.homeStatusGroupStage"),
    KNOCKOUT: t("copa.homeStatusKnockout"),
    FINISHED: t("copa.homeStatusFinished"),
  };

  return (
    <div style={{ padding: "24px 24px 0" }}>
      {/* Banner */}
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 900, letterSpacing: "-0.04em", margin: 0 }}>
          {copa.name} <span style={{ color: "#FFD426" }}>{copa.year}</span>
        </h1>
        {/* ✅ FIX: var(--text-muted) em vez de var(--text-disabled) */}
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 4 }}>
          🏆 {phaseLabel[copa.status] ?? copa.status}
          {livePhaseSummary(liveFixture, liveCount, t) && ` · ${livePhaseSummary(liveFixture, liveCount, t)}`}
        </div>
        <div style={{ fontSize: 13, color: "var(--text-muted)", marginTop: 10, lineHeight: 1.5 }}>
          {t("copa.homeIntroText")}{" "}
          <Link href="/guides/como-funciona-a-copa" style={{ color: "var(--accent)", fontWeight: 700, textDecoration: "none" }}>
            {t("copa.homeHowItWorksLink")}
          </Link>
        </div>
      </div>

      {/* Live hero */}
      {liveFixture && (
        <>
          {/* ✅ FIX: var(--text-muted) */}
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10 }}>
            {t("copa.homeLiveNow")}
          </p>
          <div
            onClick={() => router.push(`/copa/jogo/${liveFixture.id}`)}
            style={{
              // ✅ FIX: fundo var(--accent-tint) em vez de gradient vermelho
              background: "var(--accent-tint)",
              // ✅ FIX: borda var(--divider) em vez de rgba(250,36,60,.35)
              border: "1px solid var(--divider)",
              borderRadius: 16,
              padding: 18,
              marginBottom: 20,
              cursor: "pointer",
              transition: "transform 0.15s",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <Badge variant="live">{t("copa.liveBadge")}</Badge>
              {/* ✅ FIX: var(--text-muted) */}
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)" }}>
                {fixtureContextLabel(liveFixture, t).toUpperCase()}
                {liveCount > 1 ? t("copa.homeMoreGamesSuffix", { count: liveCount - 1 }) : ""}
              </span>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <CopaArtistAvatar {...liveFixture.artistA} coverUrl={liveFixture.singleACover} size={56} />
                <div style={{ fontSize: 14, fontWeight: 800, textAlign: "center", lineHeight: 1.2 }}>{liveFixture.artistA.artistName}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>"{liveFixture.singleAName}"</div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4, flexShrink: 0 }}>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <span style={{ fontSize: 48, fontWeight: 900, letterSpacing: "-0.05em" }}>{liveFixture.goalsA}</span>
                  <span style={{ fontSize: 26, color: "var(--text-muted)", margin: "0 8px" }}>-</span>
                  <span style={{ fontSize: 48, fontWeight: 900, letterSpacing: "-0.05em" }}>{liveFixture.goalsB}</span>
                </div>
                <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{t("copa.votesXVotes", { a: liveFixture.votesA, b: liveFixture.votesB })}</div>
              </div>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                <CopaArtistAvatar {...liveFixture.artistB} coverUrl={liveFixture.singleBCover} size={56} />
                <div style={{ fontSize: 14, fontWeight: 800, textAlign: "center", lineHeight: 1.2 }}>{liveFixture.artistB.artistName}</div>
                <div style={{ fontSize: 11, color: "var(--text-muted)", textAlign: "center" }}>"{liveFixture.singleBName}"</div>
              </div>
            </div>
            {/* ✅ FIX: var(--accent) */}
            <div style={{ marginTop: 14, fontSize: 12, fontWeight: 700, color: "var(--accent)", textAlign: "center" }}>
              {liveCount > 1 ? (
                <span onClick={(e) => { e.stopPropagation(); router.push("/copa/ao-vivo"); }}>
                  {t("copa.homeViewAllGamesLink", { count: liveCount })}
                </span>
              ) : (
                t("copa.tapToVote")
              )}
            </div>
          </div>
        </>
      )}

      {/* Registration state */}
      {copa.status === "REGISTRATION" && !liveFixture && (
        <div
          style={{
            background: "var(--surface)",
            border: "1px solid var(--divider)",
            borderRadius: 16,
            padding: 24,
            marginBottom: 20,
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: 36, marginBottom: 12 }}>⚽</div>
          <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 8 }}>{t("copa.homeRegistrationOpenTitle")}</div>
          <div style={{ fontSize: 14, color: "var(--text-muted)", marginBottom: 16 }}>
            {t(
              copa.participants.length !== 1 ? "copa.homeParticipantsCountPlural" : "copa.homeParticipantsCountSingular",
              { count: copa.participants.length, max: copa.maxParticipants },
            )}
            {copa.isParticipant
              ? t(
                  copa.artistsPerUser !== 1 ? "copa.homeRegisterArtistsPlural" : "copa.homeRegisterArtistsSingular",
                  { n: copa.artistsPerUser },
                )
              : t(
                  copa.artistsPerUser !== 1 ? "copa.homeJoinChooseArtistsPlural" : "copa.homeJoinChooseArtistsSingular",
                  { n: copa.artistsPerUser },
                )}
          </div>
          {copa.isParticipant ? (
            <button
              onClick={() => router.push("/copa/meu-time")}
              style={{
                background: "#FFD426",
                color: "#1D1D1F",
                border: "none",
                padding: "10px 20px",
                borderRadius: 99,
                fontSize: 14,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {t("copa.homeGoToMySquadButton")}
            </button>
          ) : (
            <button
              onClick={join}
              disabled={joining || (isFull && !!userId)}
              style={{
                background: isFull ? "var(--fill-inset)" : "#FFD426",
                // ✅ FIX: cor de texto explícita para contraste no botão amarelo
                color: isFull ? "var(--text-muted)" : "#1D1D1F",
                border: "none",
                padding: "10px 20px",
                borderRadius: 99,
                fontSize: 14,
                fontWeight: 700,
                cursor: joining || isFull ? "default" : "pointer",
                opacity: joining ? 0.6 : 1,
              }}
            >
              {isFull ? t("copa.homeSlotsFullButton") : joining ? t("copa.homeJoiningButton") : t("copa.homeJoinButton")}
            </button>
          )}
        </div>
      )}

      {/* My squad mini */}
      {myArtists.length > 0 && (
        <>
          {/* ✅ FIX: var(--text-muted) */}
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10 }}>
            {t("copa.homeMySquadSectionLabel")}
          </p>
          <div style={{ display: "flex", gap: 8, marginBottom: 20, flexWrap: "wrap" }}>
            {myArtists.map((art) => {
              const drawn = art.groupLetter !== "?";
              const qual = drawn && (art.standingRank === 0 || art.standingRank === 1);
              return (
                <div
                  key={art.id}
                  onClick={() => router.push("/copa/meu-time")}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: 6,
                    background: "var(--surface)",
                    // ✅ FIX: borda verde usa var(--up-bg) em vez de rgba(52,199,89,.35)
                    border: `1px solid ${qual ? "var(--up-bg)" : "var(--divider)"}`,
                    borderRadius: 12,
                    padding: "12px 10px",
                    cursor: "pointer",
                    minWidth: 76,
                  }}
                >
                  <CopaArtistAvatar {...art} size={38} />
                  <div style={{ fontSize: 11, fontWeight: 700, textAlign: "center", lineHeight: 1.2 }}>
                    {art.artistName.split(" ")[0]}
                  </div>
                  {drawn && <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{t("copa.homeGroupAbbrev", { letter: art.groupLetter })}</div>}
                  {qual && (
                    // ✅ FIX: var(--up-bg) + var(--up-fg) em vez de rgba(52,199,89,.12) + #34C759
                    <span style={{ fontSize: 9, fontWeight: 700, color: "var(--up-fg)", background: "var(--up-bg)", padding: "2px 7px", borderRadius: 99 }}>
                      {t("copa.homeQualifiedBadge")}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* Upcoming */}
      {upcoming && (
        <>
          {/* ✅ FIX: var(--text-muted) */}
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10 }}>
            {t("copa.homeNextGameLabel")}
          </p>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "14px",
              borderRadius: 12,
              background: "var(--surface)",
              border: "1px solid var(--divider)",
              marginBottom: 20,
            }}
          >
            <CopaArtistAvatar {...upcoming.artistA} coverUrl={upcoming.singleACover} size={32} />
            <span style={{ flex: 1, fontSize: 13, fontWeight: 700 }}>{upcoming.artistA.artistName}</span>
            <span style={{ fontSize: 12, color: "var(--text-muted)", fontWeight: 600 }}>{t("copa.homeVsLabel")}</span>
            <span style={{ flex: 1, fontSize: 13, fontWeight: 700, textAlign: "right" }}>{upcoming.artistB.artistName}</span>
            <CopaArtistAvatar {...upcoming.artistB} coverUrl={upcoming.singleBCover} size={32} />
            <Badge variant="next">GRP {upcoming.groupLetter} R{upcoming.round}</Badge>
          </div>
        </>
      )}

      {/* Recent results */}
      {recentDone.length > 0 && (
        <>
          {/* ✅ FIX: var(--text-muted) */}
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10 }}>
            {t("copa.homeRecentResultsLabel")}
          </p>
          {recentDone.map((f) => (
            <ScoreRow key={f.id} f={f} />
          ))}
        </>
      )}

      {/* Participants */}
      {/* ✅ FIX: var(--text-muted) */}
      <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: 10, marginTop: 24 }}>
        {t("copa.homeParticipantsLabel")}
      </p>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8, paddingBottom: 32 }}>
        {copa.participants.map((p) => (
          <div
            key={p.userId}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              padding: "8px 12px",
              background: "var(--surface)",
              border: "1px solid var(--divider)",
              borderRadius: 99,
            }}
          >
            <div
              style={{
                width: 24,
                height: 24,
                borderRadius: "50%",
                background: p.avatarColor,
                display: "grid",
                placeItems: "center",
                fontSize: 10,
                fontWeight: 800,
                color: "#fff",
              }}
            >
              {p.name[0]}
            </div>
            <span style={{ fontSize: 13, fontWeight: 700 }}>{p.name}</span>
            {p.userId === userId && (
              <span style={{ fontSize: 10, fontWeight: 700, color: "#FFD426" }}>{t("copa.homeYouBadge")}</span>
            )}
          </div>
        ))}
      </div>

      <style>{`
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.3} }
      `}</style>
    </div>
  );
}
