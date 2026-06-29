"use client";

import Link from "next/link";
import { useSession } from "next-auth/react";
import { Avatar } from "@/components/ui/Avatar";
import type { RoundData } from "./push-types";
import { isListenAndRankPhase, pushPoints, useTimeRemaining } from "./push-helpers";

const STEPS = [
  {
    num: "01",
    title: "Indique uma música",
    desc: "Envie a música que você quer que a comunidade conheça nesta semana",
  },
  {
    num: "02",
    title: "Ouça a playlist",
    desc: "Uma playlist no Spotify é criada com todas as indicações da rodada",
  },
  {
    num: "03",
    title: "Rankeie as músicas",
    desc: "Coloque as músicas em ordem de preferência. Do 1º ao último",
  },
  {
    num: "04",
    title: "Confira o ranking",
    desc: "Os pontos são somados e o ranking da semana é revelado para todos",
  },
] as const;

const SCORE_ROWS = [
  { rank: "#1", label: "1º no ranking de alguém", pts: 20, variant: "accent" as const },
  { rank: "#10", label: "10º no ranking de alguém", pts: pushPoints(10, 20), variant: "muted" as const },
  { rank: "#20", label: "Último no ranking (20º)", pts: 1, variant: "dim" as const },
];

function BackIcon() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

export function PushIntroTopbar() {
  const { data: session } = useSession();
  const user = session?.user;

  return (
    <div style={{
      height: 52,
      background: "var(--bg-topbar)",
      borderBottom: "1px solid var(--divider)",
      display: "flex",
      alignItems: "center",
      padding: "0 16px",
      position: "sticky",
      top: 0,
      zIndex: 20,
      backdropFilter: "blur(16px)",
      WebkitBackdropFilter: "blur(16px)",
    }}>
      <Link
        href="/"
        style={{
          display: "flex", alignItems: "center", gap: 3,
          color: "var(--accent)", fontSize: 15, fontWeight: 600,
          textDecoration: "none", letterSpacing: "-.01em",
        }}
      >
        <BackIcon />
        Início
      </Link>
      <div style={{ flex: 1, textAlign: "center", fontSize: 17, fontWeight: 800, letterSpacing: "-.03em", color: "var(--text)" }}>
        Push
      </div>
      {user?.handle ? (
        <Link href={`/profile/${user.handle}`} style={{ flexShrink: 0, textDecoration: "none" }}>
          <Avatar
            user={{ name: user.name ?? user.handle, avatar: "#FA243C" }}
            imageUrl={user.image}
            size={32}
          />
        </Link>
      ) : (
        <Link href="/login" style={{ flexShrink: 0, textDecoration: "none" }}>
          <div style={{
            width: 32, height: 32, borderRadius: "50%",
            background: "linear-gradient(135deg, #FA243C, #FF8C69)",
          }} />
        </Link>
      )}
    </div>
  );
}

function ArrowIcon() {
  return (
    <svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function RelaunchBadge() {
  return (
    <div style={{
      display: "inline-flex", alignItems: "center", gap: 6,
      background: "color-mix(in srgb, var(--accent) 12%, transparent)",
      border: "1px solid color-mix(in srgb, var(--accent) 30%, transparent)",
      borderRadius: 100, padding: "5px 12px", marginBottom: 18,
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)", display: "inline-block", flexShrink: 0 }} />
      <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: ".07em", color: "var(--accent)", textTransform: "uppercase" as const }}>
        Relançamento
      </span>
    </div>
  );
}

function PushWordmark({ size = "mobile" }: { size?: "mobile" | "desktop" }) {
  return (
    <div style={{
      fontSize: size === "desktop" ? 100 : 82,
      fontWeight: 900,
      letterSpacing: "-.065em",
      lineHeight: size === "desktop" ? 0.82 : 0.85,
      background: "linear-gradient(140deg, var(--accent) 0%, #FF7070 100%)",
      WebkitBackgroundClip: "text",
      WebkitTextFillColor: "transparent",
      backgroundClip: "text",
      marginBottom: size === "desktop" ? 18 : 14,
      position: "relative",
    }}>
      PUSH
    </div>
  );
}

function StepRow({ step, isFirst, isLast, isMobile }: { step: typeof STEPS[number]; isFirst: boolean; isLast: boolean; isMobile: boolean }) {
  if (!isMobile) return null;

  return (
    <div style={{ display: "flex", gap: 14 }}>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
        <div style={{
          width: 36, height: 36, borderRadius: "50%",
          background: isFirst ? "var(--accent)" : "color-mix(in srgb, var(--accent) 12%, transparent)",
          border: isFirst ? "none" : "1.5px solid color-mix(in srgb, var(--accent) 30%, transparent)",
          display: "flex", alignItems: "center", justifyContent: "center",
          fontSize: 13, fontWeight: 800,
          color: isFirst ? "#fff" : "var(--accent)",
          letterSpacing: "-.01em",
          boxShadow: isFirst ? "0 4px 14px color-mix(in srgb, var(--accent) 35%, transparent)" : "none",
        }}>
          {step.num}
        </div>
        {!isLast && (
          <div style={{ width: 1, flex: 1, minHeight: 18, background: "var(--divider)", margin: "5px 0" }} />
        )}
      </div>
      <div style={{ paddingTop: 7, paddingBottom: isLast ? 0 : 22, flex: 1 }}>
        <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 4, letterSpacing: "-.02em" }}>
          {step.title}
        </div>
        <div style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.55 }}>{step.desc}</div>
      </div>
    </div>
  );
}

function StepCard({ step, isFirst }: { step: typeof STEPS[number]; isFirst: boolean }) {
  return (
    <div style={{
      background: "var(--surface)", borderRadius: 14, padding: 20,
      border: "1px solid var(--divider)", position: "relative", overflow: "hidden",
    }}>
      {isFirst && (
        <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "var(--accent)" }} />
      )}
      <div style={{
        width: 36, height: 36, borderRadius: "50%",
        background: isFirst ? "var(--accent)" : "color-mix(in srgb, var(--accent) 12%, transparent)",
        border: isFirst ? "none" : "1.5px solid color-mix(in srgb, var(--accent) 30%, transparent)",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: 13, fontWeight: 800,
        color: isFirst ? "#fff" : "var(--accent)",
        marginBottom: 14,
        boxShadow: isFirst ? "0 4px 12px color-mix(in srgb, var(--accent) 30%, transparent)" : "none",
      }}>
        {step.num}
      </div>
      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text)", marginBottom: 6, letterSpacing: "-.02em" }}>
        {step.title}
      </div>
      <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.55 }}>{step.desc}</div>
    </div>
  );
}

function ScoreTable({ isMobile }: { isMobile: boolean }) {
  if (isMobile) {
    return (
      <div style={{ background: "var(--surface)", borderRadius: 14, overflow: "hidden", border: "1px solid var(--divider)" }}>
        {SCORE_ROWS.map((row, i) => (
          <div
            key={row.rank}
            style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              padding: "13px 16px",
              borderBottom: i < SCORE_ROWS.length - 1 ? "1px solid var(--divider)" : "none",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{
                width: 28, height: 28, borderRadius: 7,
                background: row.variant === "accent" ? "var(--accent)" : row.variant === "muted" ? "var(--fill-subtle)" : "var(--fill-inset)",
                display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 11, fontWeight: 800,
                color: row.variant === "accent" ? "#fff" : row.variant === "muted" ? "var(--text-muted)" : "var(--text-disabled)",
                flexShrink: 0,
              }}>
                {row.rank}
              </div>
              <span style={{ fontSize: 14, color: "var(--text)", fontWeight: 500 }}>{row.label}</span>
            </div>
            <span style={{
              fontSize: 14,
              fontWeight: row.variant === "accent" ? 800 : 700,
              color: row.variant === "accent" ? "var(--accent)" : row.variant === "muted" ? "var(--text-subtle)" : "var(--text-muted)",
            }}>
              {row.pts} pt{row.pts === 1 ? "" : "s"}
            </span>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", gap: 12 }}>
      {SCORE_ROWS.map((row) => (
        <div
          key={row.rank}
          style={{
            background: row.variant === "accent"
              ? "color-mix(in srgb, var(--accent) 10%, transparent)"
              : row.variant === "muted" ? "var(--surface)" : "var(--fill-subtle)",
            border: row.variant === "accent"
              ? "1px solid color-mix(in srgb, var(--accent) 25%, transparent)"
              : "1px solid var(--divider)",
            borderRadius: 14, padding: 20, flex: 1, textAlign: "center",
          }}
        >
          <div style={{
            fontSize: 12, fontWeight: 700,
            color: row.variant === "accent" ? "var(--accent)" : row.variant === "muted" ? "var(--text-subtle)" : "var(--text-muted)",
            marginBottom: 10, letterSpacing: ".02em",
          }}>
            {row.rank}
          </div>
          <div style={{
            fontSize: 36, fontWeight: 900,
            color: row.variant === "accent" ? "var(--accent)" : row.variant === "muted" ? "var(--text-subtle)" : "var(--text-muted)",
            letterSpacing: "-.04em", lineHeight: 1,
          }}>
            {row.pts}
          </div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 5 }}>pts</div>
        </div>
      ))}
    </div>
  );
}

function ParticipateButton({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        width: "100%", padding: "16px", borderRadius: 14,
        background: "var(--accent)", color: "#fff",
        fontSize: 16, fontWeight: 700,
        boxShadow: "var(--shadow-hero)",
        display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
        letterSpacing: "-.02em", border: "none", cursor: "pointer", fontFamily: "inherit",
      }}
    >
      Participar desta rodada
      <ArrowIcon />
    </button>
  );
}

export function PushIntroView({
  round,
  isMobile,
  onParticipate,
}: {
  round: RoundData;
  isMobile: boolean;
  onParticipate: () => void;
}) {
  const endIso =
    round.phase === "SUBMISSION" ? round.submissionEndsAt
    : isListenAndRankPhase(round.phase) ? round.rankingEndsAt
    : null;
  const timeLeft = useTimeRemaining(endIso);

  const deadlineText = timeLeft
    ? `Rodada encerra em ${timeLeft.replace(" restantes", "")}`
    : round.phase === "RESULT" ? "Rodada encerrada" : null;

  const footerExtra = round.submissionCount > 0
    ? `${round.submissionCount} participante${round.submissionCount === 1 ? "" : "s"}`
    : null;

  if (isMobile) {
    return (
      <div style={{ padding: "0 0 48px", position: "relative" }}>
        <PushIntroTopbar />
        <div style={{
          position: "absolute", top: -60, left: -60, width: 280, height: 280,
          background: "radial-gradient(circle, color-mix(in srgb, var(--accent) 22%, transparent) 0%, transparent 70%)",
          pointerEvents: "none",
        }} />

        <div style={{ padding: "30px 22px 18px", position: "relative" }}>
          <RelaunchBadge />
          <PushWordmark />
          <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "-.03em", color: "var(--text)", marginBottom: 7 }}>
            O jogo musical da semana
          </div>
          <div style={{ fontSize: 14, color: "var(--text-muted)", lineHeight: 1.6, maxWidth: 310 }}>
            Indique uma música, ouça a playlist da comunidade e descubra seu lugar no ranking.
          </div>
        </div>

        <div style={{ height: 1, background: "var(--divider)", margin: "6px 22px 26px" }} />

        <div style={{ padding: "0 22px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".09em", color: "var(--text-muted)", marginBottom: 22 }}>
            Como funciona
          </div>
          {STEPS.map((step, i) => (
            <StepRow key={step.num} step={step} isFirst={i === 0} isLast={i === STEPS.length - 1} isMobile />
          ))}
        </div>

        <div style={{ height: 1, background: "var(--divider)", margin: "28px 22px" }} />

        <div style={{ padding: "0 22px 32px" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".09em", color: "var(--text-muted)", marginBottom: 12 }}>
            Como pontuar
          </div>
          <div style={{ fontSize: 13.5, color: "var(--text-muted)", lineHeight: 1.55, marginBottom: 14 }}>
            Sua música recebe pontos de cada ouvinte conforme a posição que eles colocam ela no ranking deles.
          </div>
          <ScoreTable isMobile />
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 10, lineHeight: 1.5 }}>
            Os pontos de todos os ouvintes são somados no final da rodada.
          </div>
        </div>

        <div style={{ padding: "0 22px" }}>
          <ParticipateButton onClick={onParticipate} />
          {(deadlineText || footerExtra) && (
            <div style={{ textAlign: "center", fontSize: 12, color: "var(--text-muted)", marginTop: 10 }}>
              {[deadlineText, footerExtra].filter(Boolean).join(" · ")}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div style={{ overflow: "hidden" }}>
      <PushIntroTopbar />
      <div style={{
        display: "grid", gridTemplateColumns: "1fr 1fr",
        borderBottom: "1px solid var(--divider)", position: "relative",
      }}>
        <div style={{
          position: "absolute", top: -100, left: -100, width: 480, height: 480,
          background: "radial-gradient(circle, color-mix(in srgb, var(--accent) 18%, transparent) 0%, transparent 65%)",
          pointerEvents: "none",
        }} />

        <div style={{ padding: "48px 48px 48px 40px", borderRight: "1px solid var(--divider)", position: "relative" }}>
          <RelaunchBadge />
          <PushWordmark size="desktop" />
          <div style={{ fontSize: 22, fontWeight: 700, letterSpacing: "-.03em", color: "var(--text)" }}>
            O jogo musical da semana
          </div>
        </div>

        <div style={{ padding: "48px 40px 48px 48px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 22 }}>
          <div style={{ fontSize: 16, color: "var(--text-muted)", lineHeight: 1.65, maxWidth: 380 }}>
            Indique uma música, ouça a playlist criada pela comunidade e descubra seu lugar no ranking semanal.
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxWidth: 300 }}>
            <ParticipateButton onClick={onParticipate} />
            {(deadlineText || footerExtra) && (
              <div style={{ textAlign: "center", fontSize: 12, color: "var(--text-muted)" }}>
                {[deadlineText, footerExtra].filter(Boolean).join(" · ")}
              </div>
            )}
          </div>
        </div>
      </div>

      <div style={{ padding: "36px 40px", borderBottom: "1px solid var(--divider)" }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".09em", color: "var(--text-muted)", marginBottom: 22 }}>
          Como funciona
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16 }}>
          {STEPS.map((step, i) => (
            <StepCard key={step.num} step={step} isFirst={i === 0} />
          ))}
        </div>
      </div>

      <div style={{ padding: "36px 40px 44px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 48, alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase" as const, letterSpacing: ".09em", color: "var(--text-muted)", marginBottom: 12 }}>
            Como pontuar
          </div>
          <div style={{ fontSize: 15, color: "var(--text-muted)", lineHeight: 1.65, marginBottom: 10 }}>
            Sua música recebe pontos de cada ouvinte conforme a posição que eles colocam ela no ranking deles.
          </div>
          <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
            Os pontos de todos os ouvintes são somados no final da rodada.
          </div>
        </div>
        <ScoreTable isMobile={false} />
      </div>

      <div style={{ padding: "0 40px 32px", display: "flex", gap: 16 }}>
        <Link href="/push/historico" style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 600, textDecoration: "none" }}>
          Ver histórico de rodadas →
        </Link>
        <Link href="/push/ranking" style={{ fontSize: 13, color: "var(--text-muted)", fontWeight: 600, textDecoration: "none" }}>
          Ver ranking →
        </Link>
      </div>
    </div>
  );
}

export const PUSH_INTRO_STORAGE_KEY = "chartfm.push.intro";

export function getPushIntroDismissed(roundId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    return localStorage.getItem(`${PUSH_INTRO_STORAGE_KEY}.${roundId}`) === "1";
  } catch {
    return false;
  }
}

export function dismissPushIntro(roundId: string) {
  try {
    localStorage.setItem(`${PUSH_INTRO_STORAGE_KEY}.${roundId}`, "1");
  } catch {}
}
