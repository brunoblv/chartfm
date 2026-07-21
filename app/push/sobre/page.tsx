import type { Metadata } from "next";
import Link from "next/link";
import { Shell } from "@/components/layout/Shell";
import { StepCard, ScoreTable } from "@/components/push/PushIntroView";
import { getSteps, getScoreRows } from "@/components/push/push-content";
import { PUSH_NO_VOTE_PENALTY } from "@/lib/push-scoring";
import { PushNav } from "../PushNav";
import { getServerTranslations } from "@/lib/i18n/server-translations";

export async function generateMetadata(): Promise<Metadata> {
  const { t } = await getServerTranslations();
  return {
    title: t("push.sobreMetaTitle"),
    description: t("push.sobreMetaDescription"),
  };
}

export default async function PushSobrePage() {
  const { t } = await getServerTranslations();
  const STEPS = getSteps(t);
  const SCORE_ROWS = getScoreRows(t);
  return (
    <Shell
      title={t("push.sobreTitle")}
      subtitle={t("push.sobreSubtitle")}
      headerRight={
        <Link href="/push" style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", textDecoration: "none" }}>
          {t("push.backToCurrentRound")}
        </Link>
      }
    >
      <div style={{ maxWidth: 780 }}>
        <PushNav />

        <div
          style={{
            marginTop: 24,
            marginBottom: 28,
            padding: "28px 30px",
            borderRadius: 16,
            background: "#0F0F12",
            color: "#fff",
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#FF8C8C",
              textTransform: "uppercase",
              letterSpacing: "0.07em",
              marginBottom: 10,
            }}
          >
            {t("push.sobreEyebrow")}
          </div>
          <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: "-0.025em", marginBottom: 12, lineHeight: 1.3 }}>
            {t("push.sobreHeroTitle")}
          </div>
          <p style={{ fontSize: 14.5, color: "rgba(255,255,255,0.8)", lineHeight: 1.7, margin: 0 }}>
            {t("push.sobreHeroPrefix")} <b>{t("push.sobreHeroBold")}</b>
            {t("push.sobreHeroSuffix")}
          </p>
        </div>

        <h2
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            margin: "0 0 16px 0",
          }}
        >
          {t("push.sobreHowItWorks")}
        </h2>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: 14,
            marginBottom: 32,
          }}
        >
          {STEPS.map((step, i) => (
            <StepCard key={step.num} step={step} isFirst={i === 0} />
          ))}
        </div>

        <h2
          style={{
            fontSize: 15,
            fontWeight: 700,
            color: "var(--text-muted)",
            textTransform: "uppercase",
            letterSpacing: "0.05em",
            margin: "0 0 16px 0",
          }}
        >
          {t("push.sobreHowToScore")}
        </h2>
        <p style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.7, margin: "0 0 16px 0" }}>
          {t("push.sobreScorePrefix")} {SCORE_ROWS[0].pts} {t("push.sobreScoreMid")}
        </p>
        <ScoreTable isMobile={false} />
        <p style={{ fontSize: 12.5, color: "var(--text-muted)", marginTop: 14, lineHeight: 1.6 }}>
          {t("push.sobrePenaltyPrefix")}{PUSH_NO_VOTE_PENALTY} {t("push.sobrePenaltySuffix")}
        </p>

        <div style={{ marginTop: 32, display: "flex", gap: 16, flexWrap: "wrap" }}>
          <Link href="/push" style={{ fontSize: 13, fontWeight: 700, color: "var(--accent)", textDecoration: "none" }}>
            {t("push.sobreParticipateLink")}
          </Link>
          <Link href="/push/historico" style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", textDecoration: "none" }}>
            {t("push.sobreHistoryLink")}
          </Link>
          <Link href="/push/ranking" style={{ fontSize: 13, fontWeight: 600, color: "var(--text-muted)", textDecoration: "none" }}>
            {t("push.sobreRankingLink")}
          </Link>
        </div>
      </div>
    </Shell>
  );
}
