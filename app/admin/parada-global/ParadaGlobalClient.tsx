"use client";

import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { adminInputStyle, adminPanelStyle } from "@/components/admin/admin-styles";
import { getGlobalSnapshotDeadline, getRankingWeekReference, type GlobalPublishSlot } from "@/lib/chart-week";

const WEEKDAY_LABELS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MANUAL_PUBLISH_UNLOCK_DELAY_MS = 5 * 60 * 1000;

function formatBrt(iso: string): string {
  return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });
}

const buttonStyle = (disabled: boolean): CSSProperties => ({
  border: "none",
  background: "var(--accent)",
  color: "#fff",
  borderRadius: 10,
  padding: "10px 14px",
  fontWeight: 700,
  opacity: disabled ? 0.55 : 1,
  cursor: disabled ? "not-allowed" : "pointer",
});

export default function ParadaGlobalClient({
  initialSlot,
  weekLabel,
  deadlineIso,
  publishAtIso,
  alreadyPublished,
}: {
  initialSlot: GlobalPublishSlot;
  weekLabel: string;
  deadlineIso: string;
  publishAtIso: string;
  alreadyPublished: boolean;
}) {
  const [slot, setSlot] = useState(initialSlot);
  const [saving, setSaving] = useState(false);
  const [savedAt, setSavedAt] = useState<number | null>(null);
  const [published, setPublished] = useState(alreadyPublished);
  const [publishing, setPublishing] = useState(false);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [publishMessage, setPublishMessage] = useState<string | null>(null);
  const [nowTick, setNowTick] = useState(() => Date.now());

  // Reavalia a cada 15s para o botão de publicação manual liberar sozinho quando chegar a hora.
  useEffect(() => {
    const id = setInterval(() => setNowTick(Date.now()), 15_000);
    return () => clearInterval(id);
  }, []);

  // Recalcula localmente (mesma fórmula do servidor) para refletir a mudança na hora, antes de salvar.
  const preview = useMemo(() => {
    const rankingWeek = getRankingWeekReference(new Date(), slot);
    const deadline = getGlobalSnapshotDeadline(rankingWeek.weekIndex, slot);
    const publishAt = new Date(deadline.getTime() + 60 * 60 * 1000);
    return { deadline: deadline.toISOString(), publishAt: publishAt.toISOString() };
  }, [slot]);

  const unlockAtMs = useMemo(() => new Date(preview.publishAt).getTime() + MANUAL_PUBLISH_UNLOCK_DELAY_MS, [preview.publishAt]);
  const canPublishManually = !published && nowTick >= unlockAtMs;

  async function save(patch: Partial<GlobalPublishSlot>) {
    const next = { ...slot, ...patch };
    setSlot(next);
    setSaving(true);
    try {
      const res = await fetch("/api/admin/social/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ kind: "event-schedule", eventType: "GLOBAL100_PUBLISHED", ...next }),
      });
      if (res.ok) setSavedAt(Date.now());
    } finally {
      setSaving(false);
    }
  }

  async function publishNow() {
    setPublishing(true);
    setPublishError(null);
    setPublishMessage(null);
    try {
      const res = await fetch("/api/admin/parada-global/publish", { method: "POST" });
      const data = (await res.json()) as { error?: string; weekLabel?: string };
      if (!res.ok) {
        setPublishError(data.error ?? "Não foi possível publicar.");
        if (res.status === 409) setPublished(true);
        return;
      }
      setPublished(true);
      setPublishMessage("Parada Global publicada com sucesso!");
    } catch {
      setPublishError("Erro de conexão ao publicar.");
    } finally {
      setPublishing(false);
    }
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20, maxWidth: 560 }}>
      <section style={{ ...adminPanelStyle, padding: 20 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Publicação da Parada Global</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
          Dia da semana e horário (América/São_Paulo) em que a Parada Global (Global 100, Air Play e Álbuns) é
          publicada. As paradas pessoais dos usuários precisam ser enviadas até 1h antes desse horário para entrar
          no cálculo da semana.
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <select
            value={slot.weekday}
            onChange={(e) => save({ weekday: Number(e.target.value) })}
            style={{ ...adminInputStyle, width: 160 }}
          >
            {WEEKDAY_LABELS.map((label, idx) => (
              <option key={idx} value={idx}>
                {label}
              </option>
            ))}
          </select>
          <input
            type="time"
            value={slot.time}
            onChange={(e) => save({ time: e.target.value })}
            style={{ ...adminInputStyle, width: 120 }}
          />
          {saving && <span style={{ fontSize: 12, color: "var(--text-muted)" }}>Salvando…</span>}
          {!saving && savedAt && <span style={{ fontSize: 12, color: "#5BD16A" }}>Salvo</span>}
        </div>
      </section>

      <section style={{ ...adminPanelStyle, padding: 20 }}>
        <div style={{ fontWeight: 700, marginBottom: 12 }}>Semana atual ({weekLabel})</div>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, fontSize: 14 }}>
          <div>
            <span style={{ color: "var(--text-muted)" }}>Data limite para envio das paradas: </span>
            <strong>{formatBrt(preview.deadline)}</strong>
          </div>
          <div>
            <span style={{ color: "var(--text-muted)" }}>Publicação da Parada Global: </span>
            <strong>{formatBrt(preview.publishAt)}</strong>
          </div>
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 12 }}>
          Valores calculados a partir do horário salvo acima (servidor mostrou {formatBrt(deadlineIso)} /{" "}
          {formatBrt(publishAtIso)} ao carregar a página).
        </div>
      </section>

      <section style={{ ...adminPanelStyle, padding: 20 }}>
        <div style={{ fontWeight: 700, marginBottom: 4 }}>Publicação manual</div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 16 }}>
          Use só se o cron automático (que roda de hora em hora) não publicar sozinho. Libera 5 minutos depois do
          horário de publicação configurado acima, e some assim que a semana já tiver sido publicada.
        </div>
        {published ? (
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            A Parada Global desta semana ({weekLabel}) já foi publicada.
          </div>
        ) : (
          <>
            <button
              type="button"
              onClick={publishNow}
              disabled={!canPublishManually || publishing}
              style={buttonStyle(!canPublishManually || publishing)}
            >
              {publishing ? "Publicando…" : "Publicar agora"}
            </button>
            {!canPublishManually && (
              <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 8 }}>
                Libera às {formatBrt(new Date(unlockAtMs).toISOString())}.
              </div>
            )}
          </>
        )}
        {publishMessage && <div style={{ fontSize: 13, color: "#5BD16A", marginTop: 8 }}>{publishMessage}</div>}
        {publishError && <div style={{ fontSize: 13, color: "#e06666", marginTop: 8 }}>{publishError}</div>}
      </section>
    </div>
  );
}
