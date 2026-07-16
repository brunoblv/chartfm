"use client";

import { useMemo, useState } from "react";
import type { TiktokBotAdminData, TiktokBotAdminUser } from "@/lib/tiktok-bot";

const NICHES: { key: string; label: string }[] = [
  { key: "musica", label: "🎵 Música" },
  { key: "humor", label: "😂 Humor" },
  { key: "games", label: "🎮 Games" },
  { key: "receitas", label: "🍳 Receitas" },
  { key: "beleza", label: "💄 Beleza" },
  { key: "educacao", label: "📚 Educação" },
  { key: "fotografia", label: "📷 Fotografia" },
  { key: "outro", label: "✨ Outro" },
];

function nicheLabel(key: string | null): string {
  return NICHES.find((n) => n.key === key)?.label ?? "—";
}

const inputStyle: React.CSSProperties = {
  padding: "10px 14px",
  borderRadius: 12,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: 14,
  outline: "none",
};

const buttonStyle: React.CSSProperties = {
  padding: "8px 14px",
  borderRadius: 10,
  border: "1px solid var(--border)",
  background: "var(--surface)",
  color: "var(--text)",
  fontSize: 13,
  fontWeight: 600,
  cursor: "pointer",
};

const smallButtonStyle: React.CSSProperties = {
  ...buttonStyle,
  padding: "5px 10px",
  fontSize: 12,
};

const cardStyle: React.CSSProperties = {
  background: "var(--surface)",
  border: "1px solid var(--border)",
  borderRadius: 16,
  padding: 18,
};

const thStyle: React.CSSProperties = {
  textAlign: "left",
  fontSize: 11,
  fontWeight: 600,
  letterSpacing: "0.04em",
  textTransform: "uppercase",
  color: "var(--text-muted)",
  padding: "8px 10px",
  borderBottom: "1px solid var(--border)",
  whiteSpace: "nowrap",
};

const tdStyle: React.CSSProperties = {
  fontSize: 13,
  color: "var(--text)",
  padding: "8px 10px",
  borderBottom: "1px solid var(--border)",
  verticalAlign: "middle",
};

const labelStyle: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  color: "var(--text-muted)",
  marginBottom: 4,
  display: "block",
};

const sectionTitleStyle: React.CSSProperties = {
  fontSize: 15,
  fontWeight: 700,
  color: "var(--text)",
  marginBottom: 12,
};

const PAGE_SIZE = 20;

function formatDateTimeBr(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("pt-BR", {
    timeZone: "America/Sao_Paulo",
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function StatTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div style={{ ...cardStyle, padding: "14px 18px", flex: "1 1 130px", minWidth: 130 }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text)", fontVariantNumeric: "tabular-nums" }}>{value}</div>
      <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>{label}</div>
    </div>
  );
}

/** Gráfico de barras minimalista (CSS puro) para as séries diárias. */
function BarChart({ title, series, color }: { title: string; series: { date: string; value: number }[]; color: string }) {
  const max = Math.max(1, ...series.map((s) => s.value));
  return (
    <div style={{ flex: "1 1 300px", minWidth: 280 }}>
      <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", marginBottom: 8 }}>{title}</div>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 3, height: 90 }}>
        {series.map((s) => (
          <div
            key={s.date}
            title={`${s.date.slice(8, 10)}/${s.date.slice(5, 7)}: ${s.value}`}
            style={{
              flex: 1,
              height: `${Math.max(3, (s.value / max) * 100)}%`,
              background: s.value > 0 ? color : "var(--border)",
              borderRadius: 3,
              minWidth: 6,
            }}
          />
        ))}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
        <span>{series[0] ? `${series[0].date.slice(8, 10)}/${series[0].date.slice(5, 7)}` : ""}</span>
        <span>hoje</span>
      </div>
    </div>
  );
}

function statusOf(u: TiktokBotAdminUser): { label: string; color: string } {
  if (u.banned) return { label: "banido", color: "#e5484d" };
  if (u.pendingReview) return { label: `em revisão (${u.reportsCount}🚨)`, color: "#f5a524" };
  if (u.notFound) return { label: "conta 404", color: "#f5a524" };
  if (u.active) return { label: "ativo", color: "#06D6A0" };
  return { label: "pausado", color: "var(--text-muted)" };
}

export function TiktokBotClient({ initialData }: { initialData: TiktokBotAdminData }) {
  const [data, setData] = useState<TiktokBotAdminData>(initialData);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [busyUserId, setBusyUserId] = useState<number | null>(null);
  const [filter, setFilter] = useState("");
  const [page, setPage] = useState(1);
  const [broadcastText, setBroadcastText] = useState("");

  // Formulário de configurações (estado local; salva no PATCH)
  const [enabled, setEnabled] = useState(initialData.settings.enabled);
  const [intervalMin, setIntervalMin] = useState(String(initialData.settings.shareIntervalMinutes));
  const [perPost, setPerPost] = useState(String(initialData.settings.profilesPerPost));
  const [welcome, setWelcome] = useState(initialData.settings.welcomeMessage);
  const [adminIds, setAdminIds] = useState(initialData.settings.adminTelegramIds.join(", "));
  const [nicheFilter, setNicheFilter] = useState(initialData.settings.nicheFilter ?? "");
  const [ffEnabled, setFfEnabled] = useState(initialData.settings.followFridayEnabled);
  const [ffCount, setFfCount] = useState(String(initialData.settings.followFridayCount));
  const [surveyEnabled, setSurveyEnabled] = useState(initialData.settings.surveyEnabled);
  const [confirmEnabled, setConfirmEnabled] = useState(initialData.settings.confirmationEnabled);

  const filteredUsers = useMemo(() => {
    const f = filter.trim().toLowerCase();
    if (!f) return data.users;
    return data.users.filter(
      (u) =>
        u.tiktokUsername?.includes(f) ||
        u.telegramUsername?.toLowerCase().includes(f) ||
        u.telegramName?.toLowerCase().includes(f) ||
        u.niche?.includes(f),
    );
  }, [data.users, filter]);

  const totalPages = Math.max(1, Math.ceil(filteredUsers.length / PAGE_SIZE));
  const currentPage = Math.min(page, totalPages);
  const pageUsers = filteredUsers.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  // Rankings derivados da lista completa (item 10)
  const rankings = useMemo(() => {
    const withTiktok = data.users.filter((u) => u.tiktokUsername);
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
    return {
      maisDivulgados: [...withTiktok].sort((a, b) => b.shareCount - a.shareCount).slice(0, 10),
      novatos: withTiktok
        .filter((u) => new Date(u.createdAt).getTime() >= weekAgo)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
        .slice(0, 10),
    };
  }, [data.users]);

  async function reload() {
    const res = await fetch("/api/admin/tiktok-bot");
    if (!res.ok) return;
    setData((await res.json()) as TiktokBotAdminData);
  }

  async function action(name: string, extra?: Record<string, unknown>): Promise<Record<string, unknown> | null> {
    setBusy(name);
    setNotice(null);
    try {
      const res = await fetch("/api/admin/tiktok-bot/actions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: name, ...extra }),
      });
      return (await res.json().catch(() => null)) as Record<string, unknown> | null;
    } finally {
      setBusy(null);
    }
  }

  async function saveSettings() {
    setBusy("save");
    setNotice(null);
    try {
      const res = await fetch("/api/admin/tiktok-bot", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          enabled,
          shareIntervalMinutes: Number(intervalMin),
          profilesPerPost: Number(perPost),
          welcomeMessage: welcome,
          adminTelegramIds: adminIds.split(",").map((v) => v.trim()).filter(Boolean),
          nicheFilter: nicheFilter || null,
          followFridayEnabled: ffEnabled,
          followFridayCount: Number(ffCount),
          surveyEnabled,
          confirmationEnabled: confirmEnabled,
        }),
      });
      setNotice(res.ok ? "Configurações salvas." : "Erro ao salvar configurações.");
      await reload();
    } finally {
      setBusy(null);
    }
  }

  async function runShare() {
    const res = await action("run-share");
    setNotice(
      res?.ok
        ? `Divulgação enviada: ${res.shared} perfil(is) em ${res.groups} grupo(s).`
        : `Divulgação não enviada: ${res?.reason ?? res?.error ?? "erro"}`,
    );
    await reload();
  }

  async function runFollowFriday() {
    if (!confirm("Enviar o Follow Friday agora (lote grande de perfis)?")) return;
    const res = await action("run-follow-friday");
    setNotice(
      res?.ok
        ? `Follow Friday enviado: ${res.shared} perfil(is) em ${res.groups} grupo(s).`
        : `Follow Friday não enviado: ${res?.reason ?? res?.error ?? "erro"}`,
    );
    await reload();
  }

  async function runAccountCheck() {
    const res = await action("run-account-check");
    setNotice(
      res?.ok
        ? `Verificação de contas: ${res.checked} checada(s), ${res.notFound} não encontrada(s).`
        : `Falha na verificação: ${res?.error ?? "erro"}`,
    );
    await reload();
  }

  async function setWebhook() {
    const res = await action("set-webhook");
    setNotice(res?.ok ? `Webhook registrado: ${res.detail}` : `Falha ao registrar webhook: ${res?.detail ?? "erro"}`);
  }

  async function botInfo() {
    const res = await action("bot-info");
    setNotice(
      res?.ok
        ? `Bot: @${res.username ?? "?"} · Webhook: ${res.webhookUrl ?? "não configurado"}`
        : `Bot inacessível: ${res?.detail ?? "verifique TIKTOK_BOT_TOKEN"}`,
    );
  }

  async function broadcast() {
    const text = broadcastText.trim();
    if (!text) return;
    if (!confirm(`Enviar para todos os grupos ativos?\n\n"${text}"`)) return;
    const res = await action("broadcast", { text });
    if (res?.ok) {
      setNotice(`Broadcast enviado para ${res.sent} grupo(s).`);
      setBroadcastText("");
    } else {
      setNotice(`Falha no broadcast: ${res?.error ?? "erro"}`);
    }
  }

  async function patchUser(user: TiktokBotAdminUser, patch: Record<string, unknown>) {
    setBusyUserId(user.id);
    try {
      const res = await fetch(`/api/admin/tiktok-bot/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => null)) as { error?: string } | null;
        setNotice(`Erro: ${err?.error ?? res.status}`);
        return;
      }
      await reload();
    } finally {
      setBusyUserId(null);
    }
  }

  async function removeUser(user: TiktokBotAdminUser) {
    const label = user.tiktokUsername ? `@${user.tiktokUsername}` : user.telegramName ?? String(user.telegramId);
    if (!confirm(`Remover ${label}? O histórico de divulgações dele também será apagado.`)) return;
    setBusyUserId(user.id);
    try {
      await fetch(`/api/admin/tiktok-bot/users/${user.id}`, { method: "DELETE" });
      await reload();
    } finally {
      setBusyUserId(null);
    }
  }

  const registrationsSeries = data.dailySeries.map((d) => ({ date: d.date, value: d.registrations }));
  const sharesSeries = data.dailySeries.map((d) => ({ date: d.date, value: d.shares }));
  const totalSurveyAnswers = Math.max(1, data.stats.surveysAnswered);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 18, maxWidth: 980 }}>
      <div style={{ fontSize: 13, color: "var(--text-muted)", lineHeight: 1.5 }}>
        O bot dá boas-vindas, cadastra usuário + nicho via chat e divulga perfis em rodízio híbrido
        (70% quem espera há mais tempo, 30% sorteio com peso extra para novatos). Sexta 19h sai o
        Follow Friday; a pesquisa de retorno e a confirmação de participação vão por DM; contas 404
        são detectadas semanalmente.
      </div>

      {!data.configured && (
        <div style={{ ...cardStyle, borderColor: "#e5484d55", color: "#e5484d", fontSize: 13 }}>
          <b>TIKTOK_BOT_TOKEN não configurado.</b> Crie um bot no @BotFather, adicione
          TIKTOK_BOT_TOKEN (e TIKTOK_BOT_WEBHOOK_SECRET) no .env e use &quot;Registrar webhook&quot; abaixo.
        </div>
      )}

      {notice && <div style={{ ...cardStyle, padding: "12px 16px", fontSize: 13 }}>{notice}</div>}

      {/* Estatísticas (item 7) */}
      <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
        <StatTile label="Cadastros hoje" value={data.stats.registrationsToday} />
        <StatTile label="Cadastros na semana" value={data.stats.registrationsWeek} />
        <StatTile label="Perfis ativos" value={data.stats.activeUsers} />
        <StatTile label="Perfis pausados" value={data.stats.pausedUsers} />
        <StatTile label="Divulgações (total)" value={data.stats.totalShares} />
        <StatTile label="Divulgações hoje" value={data.stats.sharesToday} />
        <StatTile label="Seguidores estimados" value={`~${data.stats.estimatedFollowers}`} />
        <StatTile label="Volta à fila em" value={data.stats.avgQueueHours != null ? `~${data.stats.avgQueueHours}h` : "—"} />
      </div>

      {/* Dashboard (item 8) */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>Últimos 14 dias</div>
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <BarChart title="Cadastros" series={registrationsSeries} color="#06D6A0" />
          <BarChart title="Divulgações" series={sharesSeries} color="#7C5CFF" />
        </div>
      </div>

      {/* Pesquisa de retorno */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>
          Pesquisa de retorno{" "}
          <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>
            ({data.stats.surveysAnswered} resposta(s) de {data.stats.surveysAsked} enviada(s))
          </span>
        </div>
        {data.stats.surveysAnswered === 0 ? (
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Sem respostas ainda. Algumas horas após cada divulgação, o bot pergunta por DM quantos
            seguidores a pessoa ganhou — os resultados aparecem aqui.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6, maxWidth: 420 }}>
            {data.surveyBuckets.map((b) => (
              <div key={b.bucket} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                <span style={{ width: 50, color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>{b.bucket}</span>
                <div style={{ flex: 1, height: 14, background: "var(--border)", borderRadius: 7, overflow: "hidden" }}>
                  <div style={{ width: `${(b.count / totalSurveyAnswers) * 100}%`, height: "100%", background: "#06D6A0" }} />
                </div>
                <span style={{ width: 30, textAlign: "right", fontVariantNumeric: "tabular-nums" }}>{b.count}</span>
              </div>
            ))}
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
              Seguidores ganhos estimados (soma dos pontos médios): ~{data.stats.estimatedFollowers}
            </div>
          </div>
        )}
      </div>

      {/* Ações */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>Ações</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button onClick={runShare} disabled={busy !== null} style={{ ...buttonStyle, color: "#06D6A0", borderColor: "#06D6A055" }}>
            {busy === "run-share" ? "Divulgando…" : "Forçar divulgação agora"}
          </button>
          <button onClick={runFollowFriday} disabled={busy !== null} style={{ ...buttonStyle, color: "#7C5CFF", borderColor: "#7C5CFF55" }}>
            {busy === "run-follow-friday" ? "Enviando…" : "Follow Friday agora"}
          </button>
          <button onClick={runAccountCheck} disabled={busy !== null} style={buttonStyle}>
            {busy === "run-account-check" ? "Verificando…" : "Verificar contas (404)"}
          </button>
          <button onClick={botInfo} disabled={busy !== null} style={buttonStyle}>
            {busy === "bot-info" ? "Consultando…" : "Status do bot"}
          </button>
          <button onClick={setWebhook} disabled={busy !== null} style={buttonStyle}>
            {busy === "set-webhook" ? "Registrando…" : "Registrar webhook"}
          </button>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
          <input
            value={broadcastText}
            onChange={(e) => setBroadcastText(e.target.value)}
            placeholder="Mensagem de broadcast para os grupos…"
            style={{ ...inputStyle, flex: "1 1 320px" }}
          />
          <button onClick={broadcast} disabled={busy !== null || !broadcastText.trim()} style={buttonStyle}>
            {busy === "broadcast" ? "Enviando…" : "Broadcast"}
          </button>
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 10 }}>
          Última divulgação automática: {formatDateTimeBr(data.settings.lastShareAt)} · Último Follow Friday:{" "}
          {formatDateTimeBr(data.settings.lastFollowFridayAt)}
        </div>
      </div>

      {/* Configurações */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>Configurações</div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 14, alignItems: "flex-end" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text)", cursor: "pointer", paddingBottom: 10 }}>
            <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
            Divulgação automática
          </label>
          <div>
            <span style={labelStyle}>Intervalo (min)</span>
            <input value={intervalMin} onChange={(e) => setIntervalMin(e.target.value)} inputMode="numeric" style={{ ...inputStyle, width: 90 }} />
          </div>
          <div>
            <span style={labelStyle}>Perfis por post</span>
            <input value={perPost} onChange={(e) => setPerPost(e.target.value)} inputMode="numeric" style={{ ...inputStyle, width: 90 }} />
          </div>
          <div>
            <span style={labelStyle}>Divulgar nicho</span>
            <select value={nicheFilter} onChange={(e) => setNicheFilter(e.target.value)} style={{ ...inputStyle, width: 170 }}>
              <option value="">Misturar todos</option>
              {NICHES.map((n) => (
                <option key={n.key} value={n.key}>{n.label}</option>
              ))}
            </select>
          </div>
        </div>
        <div style={{ display: "flex", gap: 14, flexWrap: "wrap", marginBottom: 14, alignItems: "flex-end" }}>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text)", cursor: "pointer", paddingBottom: 10 }}>
            <input type="checkbox" checked={ffEnabled} onChange={(e) => setFfEnabled(e.target.checked)} />
            Follow Friday (sexta 19h)
          </label>
          <div>
            <span style={labelStyle}>Perfis no Follow Friday</span>
            <input value={ffCount} onChange={(e) => setFfCount(e.target.value)} inputMode="numeric" style={{ ...inputStyle, width: 90 }} />
          </div>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text)", cursor: "pointer", paddingBottom: 10 }}>
            <input type="checkbox" checked={surveyEnabled} onChange={(e) => setSurveyEnabled(e.target.checked)} />
            Pesquisa de retorno (DM)
          </label>
          <label style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 13, color: "var(--text)", cursor: "pointer", paddingBottom: 10 }}>
            <input type="checkbox" checked={confirmEnabled} onChange={(e) => setConfirmEnabled(e.target.checked)} />
            Confirmação a cada 15 dias
          </label>
        </div>
        <div style={{ marginBottom: 14 }}>
          <span style={labelStyle}>Mensagem de boas-vindas</span>
          <textarea
            value={welcome}
            onChange={(e) => setWelcome(e.target.value)}
            rows={3}
            style={{ ...inputStyle, width: "100%", boxSizing: "border-box", resize: "vertical", fontFamily: "inherit" }}
          />
        </div>
        <div style={{ marginBottom: 14 }}>
          <span style={labelStyle}>Telegram IDs de admin do bot (separados por vírgula)</span>
          <input
            value={adminIds}
            onChange={(e) => setAdminIds(e.target.value)}
            placeholder="ex.: 123456789, 987654321"
            style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
          />
          <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 4 }}>
            Esses IDs podem usar /stats, /usuarios, /ban, /broadcast e /forcar_divulgacao no chat do bot.
          </div>
        </div>
        <button onClick={saveSettings} disabled={busy !== null} style={{ ...buttonStyle, color: "#06D6A0", borderColor: "#06D6A055" }}>
          {busy === "save" ? "Salvando…" : "Salvar configurações"}
        </button>
      </div>

      {/* Rankings (item 10) */}
      <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
        <div style={{ ...cardStyle, flex: "1 1 300px" }}>
          <div style={sectionTitleStyle}>🏆 Mais divulgados</div>
          {rankings.maisDivulgados.length === 0 && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Nada ainda.</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {rankings.maisDivulgados.map((u, i) => (
              <div key={u.id} style={{ display: "flex", gap: 8, fontSize: 13, alignItems: "baseline" }}>
                <span style={{ color: "var(--text-muted)", width: 22, fontVariantNumeric: "tabular-nums" }}>{i + 1}.</span>
                <span style={{ fontWeight: 600, flex: 1 }}>@{u.tiktokUsername}</span>
                <span style={{ color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>{u.shareCount}x</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ ...cardStyle, flex: "1 1 300px" }}>
          <div style={sectionTitleStyle}>🌱 Novatos (7 dias)</div>
          {rankings.novatos.length === 0 && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Nenhum cadastro na semana.</div>}
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            {rankings.novatos.map((u) => (
              <div key={u.id} style={{ display: "flex", gap: 8, fontSize: 13, alignItems: "baseline" }}>
                <span style={{ fontWeight: 600, flex: 1 }}>@{u.tiktokUsername}</span>
                <span style={{ color: "var(--text-muted)" }}>{nicheLabel(u.niche)}</span>
                <span style={{ color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>{formatDateTimeBr(u.createdAt)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Grupos */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>
          Grupos <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>({data.groups.length})</span>
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginBottom: 10 }}>
          ⚠ Deixe o bot como <b>administrador</b> do grupo: é o que garante as boas-vindas em
          supergrupos que ocultam as mensagens de entrada (evento chat_member).
        </div>
        {data.groups.length === 0 ? (
          <div style={{ fontSize: 13, color: "var(--text-muted)" }}>
            Nenhum grupo ainda — adicione o bot a um grupo do Telegram que ele se registra sozinho.
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {data.groups.map((g) => (
              <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 13 }}>
                <span style={{ fontWeight: 600 }}>{g.title ?? g.telegramGroupId}</span>
                <span style={{ color: "var(--text-muted)", fontVariantNumeric: "tabular-nums" }}>{g.telegramGroupId}</span>
                <span style={{ fontSize: 12, fontWeight: 600, color: g.active ? "#06D6A0" : "var(--text-muted)" }}>
                  {g.active ? "ativo" : "inativo"}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Perfis */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>
          Perfis (fila de divulgação){" "}
          <span style={{ color: "var(--text-muted)", fontWeight: 500 }}>({data.users.length})</span>
          {data.stats.pendingReviewUsers > 0 && (
            <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 600, color: "#f5a524" }}>
              ⚠ {data.stats.pendingReviewUsers} aguardando revisão de denúncias
            </span>
          )}
          {data.stats.notFoundUsers > 0 && (
            <span style={{ marginLeft: 10, fontSize: 12, fontWeight: 600, color: "#f5a524" }}>
              ❓ {data.stats.notFoundUsers} com conta 404
            </span>
          )}
        </div>
        <input
          value={filter}
          onChange={(e) => { setFilter(e.target.value); setPage(1); }}
          placeholder="Filtrar por TikTok, Telegram ou nicho…"
          style={{ ...inputStyle, width: "100%", boxSizing: "border-box", marginBottom: 12, padding: "8px 12px", fontSize: 13 }}
        />
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>TikTok</th>
                <th style={thStyle}>Nicho</th>
                <th style={thStyle}>Telegram</th>
                <th style={thStyle}>Divulgações</th>
                <th style={thStyle}>Última</th>
                <th style={thStyle}>Status</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Ações</th>
              </tr>
            </thead>
            <tbody>
              {pageUsers.map((u) => {
                const st = statusOf(u);
                return (
                  <tr key={u.id}>
                    <td style={tdStyle}>
                      {u.tiktokUsername ? (
                        <a
                          href={`https://www.tiktok.com/@${u.tiktokUsername}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: "var(--text)", fontWeight: 600 }}
                        >
                          @{u.tiktokUsername}
                        </a>
                      ) : (
                        <span style={{ color: "var(--text-muted)" }}>sem cadastro</span>
                      )}
                    </td>
                    <td style={{ ...tdStyle, whiteSpace: "nowrap" }}>{nicheLabel(u.niche)}</td>
                    <td style={{ ...tdStyle, color: "var(--text-muted)" }}>
                      {u.telegramUsername ? `@${u.telegramUsername}` : u.telegramName ?? u.telegramId}
                    </td>
                    <td style={{ ...tdStyle, fontVariantNumeric: "tabular-nums" }}>{u.shareCount}</td>
                    <td style={{ ...tdStyle, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{formatDateTimeBr(u.lastSharedAt)}</td>
                    <td style={tdStyle}>
                      <span style={{ fontSize: 12, fontWeight: 600, color: st.color, whiteSpace: "nowrap" }}>{st.label}</span>
                    </td>
                    <td style={{ ...tdStyle, textAlign: "right", whiteSpace: "nowrap" }}>
                      {u.pendingReview && (
                        <button
                          onClick={() => patchUser(u, { pendingReview: false, active: true })}
                          disabled={busyUserId === u.id}
                          style={{ ...smallButtonStyle, color: "#06D6A0", borderColor: "#06D6A055", marginRight: 6 }}
                        >
                          Liberar
                        </button>
                      )}
                      <button
                        onClick={() => patchUser(u, { active: !u.active, ...(u.banned ? { banned: false } : {}) })}
                        disabled={busyUserId === u.id}
                        style={{ ...smallButtonStyle, marginRight: 6 }}
                      >
                        {u.active ? "Pausar" : "Ativar"}
                      </button>
                      <button
                        onClick={() => patchUser(u, { banned: !u.banned })}
                        disabled={busyUserId === u.id}
                        style={{ ...smallButtonStyle, marginRight: 6 }}
                      >
                        {u.banned ? "Desbanir" : "Banir"}
                      </button>
                      <button
                        onClick={() => removeUser(u)}
                        disabled={busyUserId === u.id}
                        style={{ ...smallButtonStyle, color: "#e5484d", borderColor: "#e5484d55" }}
                      >
                        Excluir
                      </button>
                    </td>
                  </tr>
                );
              })}
              {pageUsers.length === 0 && (
                <tr>
                  <td colSpan={7} style={{ ...tdStyle, color: "var(--text-muted)" }}>Nenhum perfil ainda.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 12, marginTop: 14 }}>
            <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={currentPage <= 1} style={{ ...smallButtonStyle, opacity: currentPage <= 1 ? 0.5 : 1 }}>
              ← Anterior
            </button>
            <span style={{ fontSize: 13, color: "var(--text-muted)" }}>
              Página {currentPage} de {totalPages} · {filteredUsers.length} perfil(is)
            </span>
            <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} style={{ ...smallButtonStyle, opacity: currentPage >= totalPages ? 0.5 : 1 }}>
              Próxima →
            </button>
          </div>
        )}
      </div>

      {/* Últimas divulgações */}
      <div style={cardStyle}>
        <div style={sectionTitleStyle}>Últimas divulgações</div>
        {data.recentShares.length === 0 && <div style={{ fontSize: 13, color: "var(--text-muted)" }}>Nada ainda.</div>}
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          {data.recentShares.map((s) => (
            <div key={s.id} style={{ display: "flex", alignItems: "baseline", gap: 10, fontSize: 13 }}>
              <span style={{ color: "var(--text-muted)", flexShrink: 0, fontVariantNumeric: "tabular-nums" }}>
                {formatDateTimeBr(s.sharedAt)}
              </span>
              <span style={{ fontWeight: 600 }}>{s.tiktokUsername ? `@${s.tiktokUsername}` : "—"}</span>
              <span style={{ color: "var(--text-muted)" }}>{s.groupTitle ?? "grupo"}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
