"use client";

import type { AnalyticsDashboardData } from "@/lib/analytics-metrics";
import type { EditorialAnalytics } from "@/lib/editorial-analytics";
import { BarChart, ChartCard, CohortGrid, HBarList, LineChart, StatTile } from "./charts";

function fmtDuration(seconds: number): string {
  if (seconds <= 0) return "—";
  const m = Math.floor(seconds / 60);
  const s = Math.round(seconds % 60);
  return m > 0 ? `${m}m ${String(s).padStart(2, "0")}s` : `${s}s`;
}

function fmtInt(v: number): string {
  return Math.round(v).toLocaleString("pt-BR");
}

const sectionTitle: React.CSSProperties = {
  fontSize: 18,
  fontWeight: 700,
  letterSpacing: "-0.02em",
  color: "var(--text)",
  margin: "28px 0 4px",
};

const sectionHint: React.CSSProperties = {
  fontSize: 13,
  color: "var(--text-muted)",
  margin: "0 0 14px",
};

const tilesGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
  gap: 12,
};

const cardsGrid: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))",
  gap: 12,
};

export function AnalyticsClient({ data, editorial }: { data: AnalyticsDashboardData; editorial: EditorialAnalytics }) {
  const { tiles, traffic, activity, retention } = data;
  const health = retention.paradaHealth;

  return (
    <div className="anx" style={{ maxWidth: 1100 }}>
      <style>{`
        .anx{--ch1:#FA243C;--ch2:#007AFF;}
        [data-theme="dark"] .anx{--ch1:#FF3B5C;--ch2:#0A84FF;}
        @media (prefers-color-scheme: dark){ :root:not([data-theme="light"]) .anx{--ch1:#FF3B5C;--ch2:#0A84FF;} }
      `}</style>

      {/* ── Visão geral ── */}
      <div style={tilesGrid}>
        <StatTile label="Usuários" value={fmtInt(tiles.totalUsers)} hint={`+${fmtInt(tiles.signups7d)} nos últimos 7 dias`} />
        <StatTile label="Ativos na semana (WAU)" value={fmtInt(tiles.wau)} hint="com ação nos últimos 7 dias" />
        <StatTile label="Ativos no mês (MAU)" value={fmtInt(tiles.mau)} hint="com ação nos últimos 30 dias" />
        <StatTile label="Stickiness" value={`${tiles.stickiness}%`} hint="WAU ÷ MAU" />
        <StatTile label="Atualização semanal" value={`${tiles.weeklyUpdateRate}%`} hint="da base ativa postou chart em 7d" />
        <StatTile label="Sessão média (7d)" value={fmtDuration(tiles.avgSessionSeconds7d)} hint="tempo real no site" />
        <StatTile label="Visitantes hoje" value={fmtInt(tiles.visitorsToday)} hint={`${fmtInt(tiles.loggedToday)} logados`} />
        <StatTile
          label="Conversão (visitante → cadastro)"
          value={`${tiles.conversionPct7d}%`}
          hint={`${fmtInt(tiles.signupsFromLanding7d)} de ${fmtInt(tiles.landingVisitors7d)} visitantes da landing (7d)`}
        />
      </div>

      {/* ── Tráfego ── */}
      <h2 style={sectionTitle}>Tráfego</h2>
      <p style={sectionHint}>
        Coletado pelo tracking próprio (pageviews + heartbeat). Consolidado por dia às 0h20 BRT.
        {!traffic.hasData && " A coleta começou agora — estes gráficos preenchem nos próximos dias."}
      </p>
      <div style={cardsGrid}>
        <ChartCard title="Visitantes por dia" subtitle="sessões únicas vs usuários logados">
          <LineChart
            labels={traffic.daily.map((d) => d.day)}
            series={[
              { name: "Visitantes", color: "var(--ch1)", values: traffic.daily.map((d) => d.visitors) },
              { name: "Logados", color: "var(--ch2)", values: traffic.daily.map((d) => d.logged) },
            ]}
            formatValue={fmtInt}
          />
        </ChartCard>
        <ChartCard title="Tempo médio de sessão" subtitle="por dia (dias fechados)">
          <LineChart
            labels={traffic.daily.slice(0, -1).map((d) => d.day)}
            series={[{ name: "Sessão média", color: "var(--ch1)", values: traffic.daily.slice(0, -1).map((d) => d.avgSession) }]}
            formatValue={fmtDuration}
          />
        </ChartCard>
        <ChartCard title="Páginas mais vistas" subtitle="pageviews nos últimos 7 dias">
          <HBarList items={traffic.topPaths.map((p) => ({ label: p.path, value: p.views }))} formatValue={fmtInt} />
        </ChartCard>
      </div>

      {/* ── Atividade ── */}
      <h2 style={sectionTitle}>Atividade</h2>
      <p style={sectionHint}>Calculado retroativamente das ações no app (charts, votos, comentários) — já funciona com o histórico existente. Semanas de terça a segunda.</p>
      <div style={cardsGrid}>
        <ChartCard title="Usuários ativos por semana" subtitle="qualquer ação · últimas 12 semanas">
          <LineChart
            labels={activity.weekly.map((w) => w.week)}
            series={[{ name: "Ativos", color: "var(--ch1)", values: activity.weekly.map((w) => w.active) }]}
            formatValue={fmtInt}
          />
        </ChartCard>
        <ChartCard title="Charts postados por semana" subtitle="últimas 12 semanas">
          <BarChart labels={activity.weekly.map((w) => w.week)} values={activity.weekly.map((w) => w.charts)} formatValue={fmtInt} />
        </ChartCard>
        <ChartCard title="Novos cadastros por semana" subtitle="últimas 12 semanas">
          <BarChart labels={activity.signupsWeekly.map((w) => w.week)} values={activity.signupsWeekly.map((w) => w.count)} color="var(--ch2)" formatValue={fmtInt} />
        </ChartCard>
        <ChartCard title="Atividade por dia da semana" subtitle="ações · últimas 8 semanas">
          <BarChart labels={activity.weekdayActivity.map((w) => w.weekday)} values={activity.weekdayActivity.map((w) => w.events)} formatValue={fmtInt} />
        </ChartCard>
        <ChartCard title="Uso por feature" subtitle={`usuários únicos · 30 dias · ${data.activity.multiFeaturePct}% dos ativos usam 2+ features`}>
          <HBarList
            items={activity.features.map((f) => ({ label: f.feature, value: f.users, sub: `${fmtInt(f.events)} ações` }))}
            formatValue={fmtInt}
          />
        </ChartCard>
      </div>

      {/* ── Retenção ── */}
      <h2 style={sectionTitle}>Retenção</h2>
      <p style={sectionHint}>
        Coortes por semana de cadastro × % que postou chart em cada semana seguinte (S0 = semana do cadastro).
      </p>
      <div style={{ ...tilesGrid, marginBottom: 12 }}>
        <StatTile label="Paradas ativas" value={fmtInt(health.active)} hint="chart nos últimos 7 dias" />
        <StatTile label="Esfriando" value={fmtInt(health.cooling)} hint="último chart há 8–28 dias" />
        <StatTile label="Abandonadas" value={fmtInt(health.churned)} hint="sem chart há mais de 28 dias" />
      </div>
      <ChartCard title="Coortes de cadastro" subtitle="% da coorte que postou chart na semana">
        <CohortGrid cohorts={retention.cohorts} />
      </ChartCard>

      {/* ── Editorial ── */}
      <h2 style={sectionTitle}>Editorial</h2>
      <p style={sectionHint}>Visualizações de artigos editoriais, consolidadas diariamente junto ao tráfego geral.</p>
      <div style={{ ...tilesGrid, marginBottom: 12 }}>
        <StatTile
          label="Top da semana"
          value={editorial.topArticleWeek ? fmtInt(editorial.topArticleWeek.views7d) : "—"}
          hint={editorial.topArticleWeek?.title ?? "Sem dados nos últimos 7 dias"}
        />
        <StatTile
          label="Top do mês"
          value={editorial.topArticleMonth ? fmtInt(editorial.topArticleMonth.views30d) : "—"}
          hint={editorial.topArticleMonth?.title ?? "Sem dados nos últimos 30 dias"}
        />
      </div>
      <div style={cardsGrid}>
        <ChartCard title="Artigos mais vistos" subtitle="views totais">
          <HBarList
            items={editorial.topArticles.slice(0, 10).map((a) => ({ label: a.title, value: a.viewsAllTime }))}
            formatValue={fmtInt}
          />
        </ChartCard>
        <ChartCard title="Tags mais vistas" subtitle="soma das views dos artigos com a tag">
          <HBarList
            items={editorial.tagLeaderboard.slice(0, 10).map((t) => ({ label: t.tag, value: t.views, sub: `${t.articleCount} artigo(s)` }))}
            formatValue={fmtInt}
            color="var(--ch2)"
          />
        </ChartCard>
        <ChartCard title="Views de artigos por dia" subtitle="últimos 30 dias · todos os artigos">
          <LineChart
            labels={editorial.viewsOverTime.map((d) => d.day.slice(5))}
            series={[{ name: "Views", color: "var(--ch1)", values: editorial.viewsOverTime.map((d) => d.views) }]}
            formatValue={fmtInt}
          />
        </ChartCard>
      </div>
    </div>
  );
}
