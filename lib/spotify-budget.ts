/**
 * Orçamento diário de chamadas à Spotify API por categoria de tarefa.
 *
 * Quando uma categoria estoura o orçamento do dia, só as tarefas DE FUNDO param
 * (radar, backfills, enriquecimento) — fluxos interativos (busca, publicação)
 * nunca são bloqueados por aqui; eles já são protegidos pelo cache + rate limiter
 * do spotify-server.
 *
 * Em memória (zera no restart do pm2): o objetivo é impedir que tarefas de fundo
 * consumam a API sem teto, não contabilidade exata.
 */

export type SpotifyBudgetCategory = "radar" | "backfill" | "mytrl" | "admin" | "lastfm";

const DAILY_LIMITS: Record<SpotifyBudgetCategory, number> = {
  radar: 250,
  backfill: 150,
  mytrl: 100,
  admin: 50,
  // Enriquecimento de rankings Last.fm (Global/comunidades) — só álbuns sem match no DB.
  // Airplay não consome: resolve pelo catálogo local + metadados do Last.fm.
  lastfm: 80,
};

const usage = new Map<SpotifyBudgetCategory, { day: string; used: number }>();

function todayKey(): string {
  // Dia em UTC — simples e estável; a janela exata do reset não importa aqui.
  return new Date().toISOString().slice(0, 10);
}

/**
 * Tenta consumir `n` chamadas do orçamento da categoria. Retorna false quando o
 * orçamento do dia acabou — o chamador deve parar e continuar no próximo dia/cron.
 */
export function tryConsumeSpotifyBudget(category: SpotifyBudgetCategory, n = 1): boolean {
  const day = todayKey();
  const entry = usage.get(category);
  const used = entry?.day === day ? entry.used : 0;
  if (used + n > DAILY_LIMITS[category]) return false;
  usage.set(category, { day, used: used + n });
  return true;
}

/** Uso do dia por categoria (para o dashboard /admin/logs). */
export function getSpotifyBudgetStatus(): Array<{
  category: SpotifyBudgetCategory;
  used: number;
  limit: number;
}> {
  const day = todayKey();
  return (Object.keys(DAILY_LIMITS) as SpotifyBudgetCategory[]).map((category) => {
    const entry = usage.get(category);
    return {
      category,
      used: entry?.day === day ? entry.used : 0,
      limit: DAILY_LIMITS[category],
    };
  });
}
