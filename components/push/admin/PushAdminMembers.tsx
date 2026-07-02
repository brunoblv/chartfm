"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, Music } from "lucide-react";
import { pushRoundTitle } from "@/lib/push-format";
import { PHASE_LABELS } from "./push-admin-helpers";
import type { PushAdminMembersPayload, PushAdminMemberSubmission, RoundRow } from "./push-admin-types";

function Avatar({ handle, color }: { handle: string; color: string }) {
  return (
    <div
      style={{
        width: 32,
        height: 32,
        borderRadius: 10,
        background: color,
        color: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: 12,
        fontWeight: 800,
        flexShrink: 0,
      }}
    >
      {handle.slice(0, 1).toUpperCase()}
    </div>
  );
}

function SubmissionRow({ row, isMobile }: { row: PushAdminMemberSubmission; isMobile: boolean }) {
  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: isMobile ? "1fr" : "40px minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 0.9fr) 88px",
        gap: isMobile ? 10 : 14,
        alignItems: isMobile ? "stretch" : "center",
        padding: isMobile ? "14px 16px" : "12px 16px",
        borderBottom: "1px solid var(--divider)",
      }}
    >
      {!isMobile && (
        <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-muted)", textAlign: "center" }}>{row.order}</div>
      )}

      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        {row.song.coverUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={row.song.coverUrl}
            alt=""
            width={44}
            height={44}
            style={{ borderRadius: 8, objectFit: "cover", flexShrink: 0 }}
          />
        ) : (
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 8,
              background: "var(--fill-inset)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Music size={18} color="var(--text-muted)" />
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          {isMobile && (
            <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", marginBottom: 4 }}>#{row.order}</div>
          )}
          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {row.song.title}
          </div>
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {row.song.artist}
          </div>
        </div>
        {row.song.spotifyUrl && (
          <a href={row.song.spotifyUrl} target="_blank" rel="noopener noreferrer" style={{ flexShrink: 0 }}>
            <ExternalLink size={14} color="var(--text-muted)" />
          </a>
        )}
      </div>

      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0 }}>
        <Avatar handle={row.handle} color={row.avatarColor} />
        <div style={{ minWidth: 0 }}>
          <Link
            href={`/profile/${encodeURIComponent(row.handle)}`}
            style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", textDecoration: "none" }}
          >
            @{row.handle}
          </Link>
          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {row.name}
          </div>
        </div>
      </div>

      {!isMobile && (
        <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
          {new Date(row.createdAt).toLocaleString("pt-BR", {
            day: "2-digit",
            month: "short",
            hour: "2-digit",
            minute: "2-digit",
          })}
        </div>
      )}

      <div style={{ display: "flex", alignItems: "center", justifyContent: isMobile ? "flex-start" : "center" }}>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: "4px 10px",
            borderRadius: 100,
            background: row.hasVoted ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.12)",
            color: row.hasVoted ? "#059669" : "#d97706",
          }}
        >
          {row.hasVoted ? "Avaliou" : "Pendente"}
        </span>
      </div>
    </div>
  );
}

export function PushAdminMembers({
  rounds,
  defaultRoundId,
  isMobile,
}: {
  rounds: RoundRow[];
  defaultRoundId: string | null;
  isMobile: boolean;
}) {
  const [selectedRoundId, setSelectedRoundId] = useState(defaultRoundId ?? rounds[0]?.id ?? "");
  const [data, setData] = useState<PushAdminMembersPayload | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (roundId: string) => {
    if (!roundId) {
      setData({ round: null, submissions: [] });
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/push/members?roundId=${encodeURIComponent(roundId)}`);
      const json = (await res.json()) as PushAdminMembersPayload & { error?: string };
      if (!res.ok) {
        setError(json.error ?? "Erro ao carregar membros");
        return;
      }
      setData(json);
    } catch {
      setError("Erro de conexão");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedRoundId) load(selectedRoundId);
  }, [selectedRoundId, load]);

  const round = data?.round;
  const submissions = data?.submissions ?? [];
  const votedCount = submissions.filter((s) => s.hasVoted).length;

  return (
    <div>
      <div
        style={{
          display: "flex",
          alignItems: isMobile ? "stretch" : "center",
          justifyContent: "space-between",
          gap: 12,
          marginBottom: 18,
          flexDirection: isMobile ? "column" : "row",
        }}
      >
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", letterSpacing: ".07em", textTransform: "uppercase", marginBottom: 6 }}>
            Indicações por rodada
          </div>
          <div style={{ fontSize: 14, color: "var(--text-muted)" }}>
            Músicas inscritas e quem indicou cada uma
          </div>
        </div>

        {rounds.length > 0 && (
          <select
            value={selectedRoundId}
            onChange={(e) => setSelectedRoundId(e.target.value)}
            style={{
              padding: "9px 12px",
              borderRadius: 10,
              border: "1px solid var(--divider)",
              background: "var(--surface)",
              color: "var(--text)",
              fontSize: 13,
              fontWeight: 600,
              fontFamily: "inherit",
              minWidth: isMobile ? "100%" : 220,
            }}
          >
            {rounds.map((r) => (
              <option key={r.id} value={r.id}>
                {pushRoundTitle(r.season, r.number)} · {PHASE_LABELS[r.phase]}
              </option>
            ))}
          </select>
        )}
      </div>

      {round && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 10,
            marginBottom: 16,
            fontSize: 12,
            color: "var(--text-muted)",
          }}
        >
          <span>
            <strong style={{ color: "var(--text)" }}>{submissions.length}</strong> indicaç{submissions.length === 1 ? "ão" : "ões"}
          </span>
          <span>·</span>
          <span>
            <strong style={{ color: "var(--text)" }}>{votedCount}</strong> avaliaram
          </span>
          <span>·</span>
          <span>
            Fase: <strong style={{ color: "var(--text)" }}>{PHASE_LABELS[round.phase]}</strong>
          </span>
        </div>
      )}

      {error && (
        <div style={{ padding: "12px 14px", borderRadius: 10, background: "rgba(220,38,38,0.08)", color: "#dc2626", fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {loading && (
        <div style={{ color: "var(--text-muted)", fontSize: 14, padding: "32px 0", textAlign: "center" }}>
          Carregando indicações…
        </div>
      )}

      {!loading && rounds.length === 0 && (
        <div style={{ color: "var(--text-muted)", fontSize: 14, padding: "32px 0", textAlign: "center" }}>
          Nenhuma rodada criada ainda.
        </div>
      )}

      {!loading && rounds.length > 0 && submissions.length === 0 && (
        <div style={{ color: "var(--text-muted)", fontSize: 14, padding: "32px 0", textAlign: "center" }}>
          Nenhuma música indicada nesta rodada.
        </div>
      )}

      {!loading && submissions.length > 0 && (
        <div
          style={{
            border: "1px solid var(--divider)",
            borderRadius: 14,
            overflow: "hidden",
            background: "var(--surface)",
          }}
        >
          {!isMobile && (
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "40px minmax(0, 1.4fr) minmax(0, 1fr) minmax(0, 0.9fr) 88px",
                gap: 14,
                padding: "10px 16px",
                background: "var(--fill-inset)",
                borderBottom: "1px solid var(--divider)",
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: ".06em",
                textTransform: "uppercase",
                color: "var(--text-muted)",
              }}
            >
              <div style={{ textAlign: "center" }}>#</div>
              <div>Música</div>
              <div>Indicado por</div>
              <div>Inscrição</div>
              <div style={{ textAlign: "center" }}>Avaliação</div>
            </div>
          )}

          {submissions.map((row) => (
            <SubmissionRow key={row.id} row={row} isMobile={isMobile} />
          ))}
        </div>
      )}
    </div>
  );
}
