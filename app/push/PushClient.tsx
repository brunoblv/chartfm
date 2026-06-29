"use client";

import { useState, useCallback, useEffect } from "react";
import Link from "next/link";
import { Shell } from "@/components/layout/Shell";
import { useIsMobile } from "@/hooks/useIsMobile";
import type { RoundData } from "@/components/push/push-types";
import { isListenAndRankPhase } from "@/components/push/push-helpers";
import { RoundHeader, StatsSidebar } from "@/components/push/PushRoundHeader";
import { SubmissionView } from "@/components/push/PushSubmissionView";
import { ListenAndRankView } from "@/components/push/PushListenRankView";
import { ResultView, NoRoundView } from "@/components/push/PushResultView";
import { PushIntroView, dismissPushIntro, getPushIntroDismissed } from "@/components/push/PushIntroView";

export type { RoundData, SongData } from "@/components/push/push-types";

function shouldSkipIntro(round: RoundData): boolean {
  if (round.mySubmission) return true;
  if (round.myVotes && round.myVotes.length > 0) return true;
  return getPushIntroDismissed(round.id);
}

export default function PushClient({ initialRound }: { initialRound: RoundData | null }) {
  const [round, setRound] = useState<RoundData | null>(initialRound);
  const [showIntro, setShowIntro] = useState(false);
  const [introReady, setIntroReady] = useState(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    if (!round) {
      setShowIntro(false);
      setIntroReady(true);
      return;
    }
    setShowIntro(!shouldSkipIntro(round));
    setIntroReady(true);
  }, [round?.id]);

  const handleParticipate = useCallback(() => {
    if (round) dismissPushIntro(round.id);
    setShowIntro(false);
  }, [round]);

  const refresh = useCallback(async () => {
    try {
      const res  = await fetch("/api/push");
      const data = (await res.json()) as { round: RoundData | null };
      if (data.round) setRound(data.round);
    } catch {}
  }, []);

  function handleSubmitted(sub: RoundData["mySubmission"]) {
    setRound((r) => r ? { ...r, mySubmission: sub, submissionCount: r.submissionCount + 1 } : r);
  }

  if (!round) {
    return (
      <Shell noPadding>
        <NoRoundView />
      </Shell>
    );
  }

  if (!introReady) {
    return (
      <Shell noPadding hideTopBar>
        {null}
      </Shell>
    );
  }

  if (showIntro) {
    return (
      <Shell noPadding hideTopBar>
        <div style={{ padding: isMobile ? "0 0 88px" : 0 }}>
          <PushIntroView round={round} isMobile={isMobile} onParticipate={handleParticipate} />
        </div>
      </Shell>
    );
  }

  const content = (
    <>
      {round.phase === "SUBMISSION" && <SubmissionView round={round} onSubmitted={handleSubmitted} />}
      {isListenAndRankPhase(round.phase) && <ListenAndRankView round={round} onSaved={refresh} />}
      {round.phase === "RESULT" && <ResultView round={round} />}
      {isMobile && (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 28 }}>
          <Link href="/push/ranking" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-muted)", fontWeight: 600, textDecoration: "none" }}>
            Ver ranking
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
          </Link>
          <Link href="/push/historico" style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 13, color: "var(--text-muted)", fontWeight: 600, textDecoration: "none" }}>
            Ver histórico de rodadas
            <svg width={14} height={14} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
          </Link>
        </div>
      )}
    </>
  );

  return (
    <Shell noPadding>
      <div style={{ padding: isMobile ? "16px 16px 88px" : "28px 40px 60px" }}>
        <RoundHeader round={round} isMobile={isMobile} />
        {isMobile ? (
          content
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 280px", gap: 28, alignItems: "flex-start" }}>
            <div style={{ minWidth: 0 }}>{content}</div>
            <div style={{ position: "sticky", top: 76 }}>
              <StatsSidebar round={round} />
            </div>
          </div>
        )}
      </div>
    </Shell>
  );
}
