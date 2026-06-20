"use client";

import type { ReactNode } from "react";
import { pushRoundTitle } from "@/lib/push-format";
import type { RoundData } from "./push-types";
import { STAGES, PHASE_TO_STAGE, isListenAndRankPhase, phaseLabel, phaseColor, useTimeRemaining } from "./push-helpers";
import { CheckIcon, ParticipantAvatar } from "./PushAtoms";

export function StageBar({ phase }: { phase: RoundData["phase"] }) {
  const activeIdx = PHASE_TO_STAGE[phase];
  const items: ReactNode[] = [];

  STAGES.forEach((label, i) => {
    const done = i < activeIdx;
    const cur  = i === activeIdx;
    items.push(
      <div key={"d" + i} style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 3, flexShrink: 0 }}>
        <div style={{ width: 7, height: 7, borderRadius: 4, background: done || cur ? "var(--accent)" : "var(--text-disabled)" }} />
        <div style={{ fontSize: 8, fontWeight: 600, whiteSpace: "nowrap", color: done || cur ? "var(--accent)" : "var(--text-muted)" }}>
          {label}
        </div>
      </div>
    );
    if (i < STAGES.length - 1) {
      items.push(
        <div key={"l" + i} style={{ flex: 1, height: 1, background: done ? "var(--accent)" : "var(--text-disabled)", marginBottom: 11 }} />
      );
    }
  });

  return <div style={{ display: "flex", alignItems: "center" }}>{items}</div>;
}

export function RoundHeader({ round, isMobile }: { round: RoundData; isMobile: boolean }) {
  const endIso =
    round.phase === "SUBMISSION" ? round.submissionEndsAt
    : isListenAndRankPhase(round.phase) ? round.rankingEndsAt
    : null;
  const timeLeft = useTimeRemaining(endIso);
  const color = phaseColor(round.phase);

  return (
    <div style={{
      background: "var(--surface)", borderRadius: 16, border: "1px solid var(--divider)",
      padding: isMobile ? "14px 16px" : "18px 22px", marginBottom: 24,
    }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 12 }}>
        <div style={{ fontSize: isMobile ? 22 : 26, fontWeight: 900, color: "var(--text)", letterSpacing: "-.03em", lineHeight: 1 }}>
          {pushRoundTitle(round.season, round.number)}
        </div>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 5 }}>
          <span style={{
            padding: "3px 10px", borderRadius: 100,
            background: color + "18", color, border: `1px solid ${color}33`,
            fontSize: 10, fontWeight: 800, letterSpacing: ".04em", textTransform: "uppercase" as const,
          }}>
            {phaseLabel(round.phase)}
          </span>
          {timeLeft && (
            <span style={{ fontSize: 10, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>
              {timeLeft}
            </span>
          )}
        </div>
      </div>
      <StageBar phase={round.phase} />
    </div>
  );
}

export function ParticipantsSection({ round }: { round: RoundData }) {
  const submitted = round.participants;
  const total = round.submissionCount;

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
        <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase" as const, color: "var(--text-muted)" }}>
          Participantes
        </span>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
          {submitted.length}/{total > submitted.length ? total : submitted.length} indicaram
        </span>
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
        {submitted.map((p) => (
          <div key={p.userId} style={{
            display: "flex", alignItems: "center", gap: 4,
            padding: "4px 9px 4px 5px", borderRadius: 100,
            background: "color-mix(in srgb, var(--accent) 10%, transparent)",
            border: "1px solid color-mix(in srgb, var(--accent) 22%, transparent)",
          }}>
            <div style={{
              width: 15, height: 15, borderRadius: 7.5, background: "var(--accent)",
              display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
            }}>
              <CheckIcon size={7} />
            </div>
            <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text)" }}>
              {p.isMe ? "Você" : (p.name?.split(" ")[0] ?? p.handle ?? "?")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function StatsSidebar({ round }: { round: RoundData }) {
  const endIso =
    round.phase === "SUBMISSION" ? round.submissionEndsAt
    : isListenAndRankPhase(round.phase) ? round.rankingEndsAt
    : null;
  const timeLeft = useTimeRemaining(endIso);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      {round.participants.length > 0 && (
        <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", padding: "18px 20px", boxShadow: "0 1px 2px rgba(0,0,0,.04)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase" as const, color: "var(--text-muted)", marginBottom: 14 }}>
            Participantes
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 9 }}>
            {round.participants.map((p) => (
              <div key={p.userId} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <ParticipantAvatar p={p} size={30} />
                <div style={{ flex: 1, fontSize: 13, fontWeight: 600, color: p.isMe ? "var(--accent)" : "var(--text)" }}>
                  {p.isMe ? "Você" : (p.name?.split(" ")[0] ?? p.handle ?? "?")}
                </div>
                <div style={{ width: 18, height: 18, borderRadius: 9, background: "#1DB954", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                  <CheckIcon color="white" size={8} />
                </div>
              </div>
            ))}
          </div>
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: "1px solid var(--divider)", fontSize: 12, color: "var(--text-muted)", textAlign: "center" as const }}>
            {round.participants.length}/{round.submissionCount} indicaram
          </div>
        </div>
      )}

      <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", padding: "18px 20px", boxShadow: "0 1px 2px rgba(0,0,0,.04)" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase" as const, color: "var(--text-muted)", marginBottom: 12 }}>
          Rodada #{round.number}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            { label: "Temporada",      value: String(round.season),          accent: false },
            { label: "Músicas",        value: String(round.submissionCount), accent: false },
            { label: "Fase atual",     value: phaseLabel(round.phase),       accent: true  },
            ...(isListenAndRankPhase(round.phase)
              ? [{ label: "Escuta até", value: new Date(round.rankingEndsAt).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }), accent: false }]
              : []),
            ...(timeLeft ? [{ label: "Tempo restante", value: timeLeft, accent: false }] : []),
          ].map(({ label, value, accent }) => (
            <div key={label} style={{ display: "flex", justifyContent: "space-between", fontSize: 13 }}>
              <span style={{ color: "var(--text-muted)" }}>{label}</span>
              <span style={{ fontWeight: 600, color: accent ? "var(--accent)" : "var(--text)" }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ background: "var(--surface)", borderRadius: 18, border: "1px solid var(--divider)", padding: "18px 20px", boxShadow: "0 1px 2px rgba(0,0,0,.04)" }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".07em", textTransform: "uppercase" as const, color: "var(--text-muted)", marginBottom: 12 }}>
          Regras
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {[
            "Lançamento máx. 12 meses",
            "1 indicação por participante",
            "Músicas ficam ocultas até a revelação",
            "Escuta começa logo após a revelação",
            "#1 = 20 pts · último = 1 pt",
          ].map((rule, i) => (
            <div key={i} style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
              <div style={{
                width: 16, height: 16, borderRadius: 8,
                background: "color-mix(in srgb, var(--accent) 12%, transparent)",
                color: "var(--accent)", display: "flex", alignItems: "center", justifyContent: "center",
                fontSize: 9, fontWeight: 800, flexShrink: 0, marginTop: 1,
              }}>
                {i + 1}
              </div>
              <div style={{ fontSize: 12, color: "var(--text-subtle)", lineHeight: 1.5 }}>{rule}</div>
            </div>
          ))}
        </div>
      </div>

      <a href="/push/historico" style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "12px 16px", borderRadius: 12, background: "var(--surface)",
        border: "1px solid var(--divider)", textDecoration: "none",
      }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)" }}>Histórico</div>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 1 }}>Ver todas as rodadas</div>
        </div>
        <svg width={16} height={16} viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth={2} strokeLinecap="round"><path d="M9 18l6-6-6-6" /></svg>
      </a>
    </div>
  );
}
