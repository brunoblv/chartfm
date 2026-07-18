"use client";

import { useCallback, useEffect, useMemo, useState } from "react";

type PeakPotential = "1" | "top3" | "top5" | "top10" | "top20" | "top40" | "top100" | "out";
type HitLevel = "diamond" | "platinum" | "gold" | "silver" | "bronze" | "none";
type Priority = "S" | "A" | "B" | "C" | "D";
type Confidence = "alta" | "media" | "baixa";
type RetroMode = "historico" | "retrospectivo";

interface ScoreBreakdown {
  period: number;
  importance: number;
  top20: number;
  releaseRecency: number;
  clip: number;
  adjust: number;
}

interface RetroEntry {
  songId: string;
  position: number;
  title: string;
  artist: string;
  importance: number;
  importanceIsManual: boolean;
  importanceLocked: boolean;
  scoreFinal: number;
  breakdown: ScoreBreakdown;
  peakPotential: PeakPotential;
  peakPotentialIsManual: boolean;
  hitLevel: HitLevel;
  priority: Priority;
  confidence: Confidence;
  eraWeight: number;
  overallPlaycount: number;
  periodPlaycount: number | null;
  top20Weeks: number;
  top20BestPeak: number | null;
  numberOnes: number;
  manualAdjustment: number;
  note: string | null;
}

interface RetroResponse {
  period: { year: number; month: number; mode: RetroMode };
  chartDate: string;
  usesRealPeriodData: boolean;
  stats: {
    eligible: number;
    withPeriodPlays: number;
    everInTop20: number;
    everNumberOne: number;
    diamonds: number;
    matched: number;
    unmatched: number;
  };
  entries: RetroEntry[];
}

const MONTHS = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

const PEAK_LABEL: Record<PeakPotential, string> = {
  "1": "#1", top3: "Top 3", top5: "Top 5", top10: "Top 10",
  top20: "Top 20", top40: "Top 40", top100: "Top 100", out: "Fora",
};
const PEAK_ORDER: PeakPotential[] = ["1", "top3", "top5", "top10", "top20", "top40", "top100", "out"];

const HIT_STYLE: Record<HitLevel, { label: string; cls: string }> = {
  diamond: { label: "Diamond", cls: "bg-cyan-500/15 text-cyan-300" },
  platinum: { label: "Platinum", cls: "bg-slate-300/15 text-slate-200" },
  gold: { label: "Gold", cls: "bg-amber-500/15 text-amber-300" },
  silver: { label: "Silver", cls: "bg-zinc-400/15 text-zinc-300" },
  bronze: { label: "Bronze", cls: "bg-orange-700/20 text-orange-300" },
  none: { label: "—", cls: "bg-white/5 text-white/40" },
};

const PRIORITY_STYLE: Record<Priority, string> = {
  S: "bg-rose-500/20 text-rose-300",
  A: "bg-fuchsia-500/20 text-fuchsia-300",
  B: "bg-indigo-500/20 text-indigo-300",
  C: "bg-sky-500/20 text-sky-300",
  D: "bg-white/5 text-white/40",
};

const CONFIDENCE_LABEL: Record<Confidence, string> = { alta: "Alta", media: "Média", baixa: "Baixa" };

const WEIGHT_ROWS: { key: keyof ScoreBreakdown; label: string; max: number; bar: string }[] = [
  { key: "period", label: "Plays do período", max: 30, bar: "bg-emerald-400" },
  { key: "importance", label: "Importância", max: 30, bar: "bg-sky-400" },
  { key: "top20", label: "Histórico Top 20", max: 15, bar: "bg-violet-400" },
  { key: "releaseRecency", label: "Recência do lançamento", max: 10, bar: "bg-amber-400" },
  { key: "clip", label: "Data do clipe", max: 10, bar: "bg-cyan-400" },
  { key: "adjust", label: "Ajustes manuais", max: 5, bar: "bg-rose-400" },
];

const CURRENT_YEAR = new Date().getFullYear();
const YEARS = Array.from({ length: CURRENT_YEAR - 2000 + 1 }, (_, i) => CURRENT_YEAR - i);

function ScoreRing({ value, size = 44 }: { value: number; size?: number }) {
  const pct = Math.max(0, Math.min(100, value));
  const hue = 120 * (pct / 100);
  const inner = size - 12;
  return (
    <div
      className="grid place-items-center rounded-full font-semibold text-white"
      style={{ width: size, height: size, background: `conic-gradient(hsl(${hue} 70% 45%) ${pct}%, rgba(255,255,255,0.08) 0)` }}
    >
      <span className="grid place-items-center rounded-full bg-[#151518]" style={{ width: inner, height: inner, fontSize: size / 3.6 }}>
        {Math.round(pct)}
      </span>
    </div>
  );
}

function StatTile({ value, label }: { value: number; label: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <div className="text-2xl font-semibold text-white">{value.toLocaleString("pt-BR")}</div>
      <div className="mt-0.5 text-xs text-white/50">{label}</div>
    </div>
  );
}

function reasonsFor(e: RetroEntry): string[] {
  const r: string[] = [];
  if (e.importance >= 80) r.push(`Importância muito alta (${Math.round(e.importance)}/100)`);
  if (e.periodPlaycount && e.periodPlaycount > 0) r.push(`${e.periodPlaycount} plays no período`);
  else if (e.overallPlaycount > 0) r.push(`${e.overallPlaycount.toLocaleString("pt-BR")} plays no total`);
  if (e.numberOnes > 0) r.push(`Já teve ${e.numberOnes}× #1 na sua Top 20`);
  if (e.top20BestPeak != null) r.push(`Pico #${e.top20BestPeak} na sua Top 20`);
  if (e.top20Weeks > 0) r.push(`${e.top20Weeks} semanas na Top 20`);
  if (e.breakdown.clip > 0) r.push("Clipe lançado antes da data do chart");
  return r;
}

interface Draft {
  impManual: boolean;
  impValue: number;
  peak: PeakPotential | "auto";
  adjust: number;
  note: string;
}

function draftFrom(e: RetroEntry): Draft {
  return {
    impManual: e.importanceIsManual,
    impValue: Math.round(e.importance),
    peak: e.peakPotentialIsManual ? e.peakPotential : "auto",
    adjust: e.manualAdjustment,
    note: e.note ?? "",
  };
}

export function RetroClient() {
  const [year, setYear] = useState(2005);
  const [month, setMonth] = useState(5);
  const [mode, setMode] = useState<RetroMode>("retrospectivo");
  const [data, setData] = useState<RetroResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const selected = useMemo(
    () => data?.entries.find((e) => e.songId === selectedId) ?? null,
    [data, selectedId],
  );

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/retro/chart?year=${year}&month=${month}&mode=${mode}`);
      const body = await res.json();
      if (!res.ok) {
        setError(body?.error ?? "erro");
        setData(null);
      } else {
        setData(body as RetroResponse);
      }
    } catch {
      setError("network");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [year, month, mode]);

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function openSong(e: RetroEntry) {
    setSelectedId(e.songId);
    setDraft(draftFrom(e));
  }

  async function saveDraft() {
    if (!selected || !draft) return;
    setSaving(true);
    try {
      const res = await fetch("/api/retro/song-profile", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          songId: selected.songId,
          importance: draft.impManual ? draft.impValue : null,
          peakPotential: draft.peak === "auto" ? null : draft.peak,
          manualAdjustment: draft.adjust,
          note: draft.note.trim() === "" ? null : draft.note,
        }),
      });
      if (res.ok) {
        await load();
        // Re-sincroniza o rascunho com os valores recalculados.
        setData((prev) => {
          const fresh = prev?.entries.find((e) => e.songId === selected.songId);
          if (fresh) setDraft(draftFrom(fresh));
          return prev;
        });
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-5 text-white">
      {/* Controles */}
      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-white/10 bg-white/[0.02] p-4">
        <label className="flex flex-col gap-1 text-xs text-white/50">
          Período da parada
          <div className="flex gap-2">
            <select value={month} onChange={(ev) => setMonth(Number(ev.target.value))}
              className="rounded-lg border border-white/10 bg-[#151518] px-3 py-2 text-sm text-white">
              {MONTHS.map((m, i) => <option key={m} value={i + 1}>{m}</option>)}
            </select>
            <select value={year} onChange={(ev) => setYear(Number(ev.target.value))}
              className="rounded-lg border border-white/10 bg-[#151518] px-3 py-2 text-sm text-white">
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
          </div>
        </label>

        <label className="flex flex-col gap-1 text-xs text-white/50">
          Modo
          <select value={mode} onChange={(ev) => setMode(ev.target.value as RetroMode)}
            className="rounded-lg border border-white/10 bg-[#151518] px-3 py-2 text-sm text-white">
            <option value="retrospectivo">Retrospectivo</option>
            <option value="historico">Histórico</option>
          </select>
        </label>

        <button onClick={() => void load()} disabled={loading}
          className="ml-auto rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">
          {loading ? "Calculando…" : "↻ Recalcular"}
        </button>
      </div>

      {error === "no_lastfm_user" && (
        <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-200">
          Nenhum usuário do Last.fm configurado na sua conta.
        </div>
      )}
      {error && error !== "no_lastfm_user" && (
        <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-200">
          Não foi possível carregar a parada ({error}).
        </div>
      )}

      {data && (
        <>
          <div className="text-xs text-white/40">
            Parada de {MONTHS[data.period.month - 1]} de {data.period.year} ·{" "}
            {data.usesRealPeriodData ? "plays reais do período" : "antes de Out/2010 → estimado"} ·{" "}
            {data.stats.matched} faixas casadas ({data.stats.unmatched} sem correspondência)
          </div>

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            <StatTile value={data.stats.eligible} label="Músicas elegíveis" />
            <StatTile value={data.stats.withPeriodPlays} label="Com plays no período" />
            <StatTile value={data.stats.everInTop20} label="Já entraram na Top 20" />
            <StatTile value={data.stats.everNumberOne} label="Tiveram #1" />
            <StatTile value={data.stats.diamonds} label="Diamonds" />
          </div>

          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs text-white/40">
                  <th className="px-3 py-3 font-medium">#</th>
                  <th className="px-3 py-3 font-medium">Música</th>
                  <th className="px-3 py-3 font-medium">Importância</th>
                  <th className="px-3 py-3 font-medium">Peak</th>
                  <th className="px-3 py-3 font-medium">Hit Level</th>
                  <th className="px-3 py-3 font-medium">Prioridade</th>
                  <th className="px-3 py-3 font-medium">Confiança</th>
                  <th className="px-3 py-3 font-medium">Score</th>
                </tr>
              </thead>
              <tbody>
                {data.entries.map((e) => (
                  <tr key={e.songId} onClick={() => openSong(e)}
                    className={`cursor-pointer border-b border-white/5 hover:bg-white/[0.04] ${selectedId === e.songId ? "bg-white/[0.05]" : ""}`}>
                    <td className="px-3 py-2 tabular-nums text-white/50">{e.position}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium">{e.title}</div>
                      <div className="text-xs text-white/40">{e.artist}</div>
                    </td>
                    <td className="px-3 py-2">
                      <span className="tabular-nums">{Math.round(e.importance)}</span>
                      {e.importanceIsManual && <span className="ml-1 text-xs text-amber-400" title="ajustado manualmente">✎</span>}
                    </td>
                    <td className="px-3 py-2 text-white/70">{PEAK_LABEL[e.peakPotential]}</td>
                    <td className="px-3 py-2">
                      <span className={`rounded-md px-2 py-0.5 text-xs font-medium ${HIT_STYLE[e.hitLevel].cls}`}>{HIT_STYLE[e.hitLevel].label}</span>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`rounded-md px-2 py-0.5 text-xs font-bold ${PRIORITY_STYLE[e.priority]}`}>{e.priority}</span>
                    </td>
                    <td className="px-3 py-2 text-xs text-white/50">{CONFIDENCE_LABEL[e.confidence]}</td>
                    <td className="px-3 py-2"><ScoreRing value={e.scoreFinal} /></td>
                  </tr>
                ))}
                {data.entries.length === 0 && (
                  <tr><td colSpan={8} className="px-3 py-10 text-center text-white/40">Nenhuma música elegível para este período.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {/* Painel lateral de detalhes */}
      {selected && draft && (
        <>
          <div className="fixed inset-0 z-40 bg-black/40" onClick={() => setSelectedId(null)} />
          <aside className="fixed right-0 top-0 z-50 flex h-full w-full max-w-[400px] flex-col overflow-y-auto border-l border-white/10 bg-[#0f0f12] p-5 text-white shadow-2xl">
            <div className="flex items-start justify-between">
              <div>
                <div className="text-xs text-white/40">#{selected.position} · Detalhes da música</div>
                <div className="mt-1 text-lg font-semibold">{selected.title}</div>
                <div className="text-sm text-white/50">{selected.artist}</div>
              </div>
              <button onClick={() => setSelectedId(null)} className="rounded-md px-2 py-1 text-white/50 hover:bg-white/5">✕</button>
            </div>

            <div className="mt-4 flex items-center gap-4 rounded-xl border border-white/10 bg-white/[0.03] p-3">
              <ScoreRing value={selected.scoreFinal} size={56} />
              <div>
                <div className="text-xs text-white/40">Score Final</div>
                <div className="text-xl font-semibold">{selected.scoreFinal.toFixed(1)} <span className="text-sm text-white/40">/ 100</span></div>
                <div className="text-xs text-white/40">
                  Pico provável {PEAK_LABEL[selected.peakPotential]} · Confiança {CONFIDENCE_LABEL[selected.confidence]}
                </div>
              </div>
            </div>

            {/* Por que está aqui */}
            <div className="mt-4">
              <div className="mb-2 text-sm font-medium text-white/70">Por que essa música está aqui?</div>
              <ul className="space-y-1 text-sm text-white/60">
                {reasonsFor(selected).map((r) => (
                  <li key={r} className="flex gap-2"><span className="text-emerald-400">✔</span>{r}</li>
                ))}
              </ul>
            </div>

            {/* Pesos do cálculo */}
            <div className="mt-5">
              <div className="mb-2 text-sm font-medium text-white/70">Pesos do cálculo</div>
              <div className="space-y-2">
                {WEIGHT_ROWS.map((w) => {
                  const val = selected.breakdown[w.key];
                  return (
                    <div key={w.key} className="text-xs">
                      <div className="flex justify-between text-white/50">
                        <span>{w.label}</span>
                        <span className="tabular-nums">{val.toFixed(1)} / {w.max}</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-white/5">
                        <div className={`h-1.5 rounded-full ${w.bar}`} style={{ width: `${Math.min(100, (val / w.max) * 100)}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Editor */}
            <div className="mt-6 space-y-4 border-t border-white/10 pt-4">
              {/* Importância */}
              <div>
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-sm font-medium text-white/70">Importância</span>
                  <label className="flex items-center gap-1 text-xs text-white/50">
                    <input type="checkbox" checked={draft.impManual}
                      onChange={(ev) => setDraft({ ...draft, impManual: ev.target.checked })} />
                    Manual
                  </label>
                </div>
                <div className="flex items-center gap-3">
                  <input type="range" min={0} max={100} value={draft.impValue} disabled={!draft.impManual}
                    onChange={(ev) => setDraft({ ...draft, impValue: Number(ev.target.value) })}
                    className="w-full disabled:opacity-40" />
                  <span className="w-9 text-right text-sm tabular-nums">{draft.impManual ? draft.impValue : Math.round(selected.importance)}</span>
                </div>
                {!draft.impManual && <div className="mt-0.5 text-xs text-white/30">Usando valor calculado automaticamente.</div>}
              </div>

              {/* Peak Potential */}
              <div>
                <div className="mb-1 text-sm font-medium text-white/70">Peak Potential</div>
                <select value={draft.peak} onChange={(ev) => setDraft({ ...draft, peak: ev.target.value as Draft["peak"] })}
                  className="w-full rounded-lg border border-white/10 bg-[#151518] px-3 py-2 text-sm">
                  <option value="auto">Automático ({PEAK_LABEL[selected.peakPotential]})</option>
                  {PEAK_ORDER.map((p) => <option key={p} value={p}>{PEAK_LABEL[p]}</option>)}
                </select>
              </div>

              {/* Ajuste manual */}
              <div>
                <div className="mb-1 flex items-center justify-between text-sm font-medium text-white/70">
                  <span>Ajuste manual</span>
                  <span className="tabular-nums text-white/50">{draft.adjust > 0 ? `+${draft.adjust}` : draft.adjust}</span>
                </div>
                <input type="range" min={-50} max={50} value={draft.adjust}
                  onChange={(ev) => setDraft({ ...draft, adjust: Number(ev.target.value) })} className="w-full" />
              </div>

              {/* Nota */}
              <div>
                <div className="mb-1 text-sm font-medium text-white/70">Observação pessoal</div>
                <textarea value={draft.note} onChange={(ev) => setDraft({ ...draft, note: ev.target.value })}
                  rows={3} placeholder="Essa música marcou minha adolescência…"
                  className="w-full resize-none rounded-lg border border-white/10 bg-[#151518] px-3 py-2 text-sm" />
              </div>

              <button onClick={() => void saveDraft()} disabled={saving}
                className="w-full rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black disabled:opacity-50">
                {saving ? "Salvando…" : "Salvar e recalcular"}
              </button>
            </div>
          </aside>
        </>
      )}
    </div>
  );
}
