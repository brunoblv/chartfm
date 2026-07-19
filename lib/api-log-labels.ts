/**
 * Rótulos em português para logs de API — pensados para leitura no /admin/logs
 * por quem não é técnico.
 */

export type ApiTrigger = "manual" | "automatic";

export function triggerLabel(trigger: ApiTrigger | string): string {
  if (trigger === "automatic") return "Automática";
  if (trigger === "manual") return "Manual";
  return trigger;
}

export function sourceWhoLabel(opts: {
  source: string;
  userName?: string | null;
  userHandle?: string | null;
}): string {
  if (opts.source === "system") return "Sistema (tarefa automática)";
  if (opts.source === "anonymous") return "Visitante (sem login)";
  const name = (opts.userName ?? "").trim() || "Usuário";
  const handle = (opts.userHandle ?? "").trim();
  return handle ? `${name} (@${handle})` : name;
}

/** Descreve a rota interna do ChartFM em linguagem simples. */
export function friendlyApiPath(path: string): string {
  const p = path.split("?")[0] ?? path;

  const exact: Record<string, string> = {
    "/api/charts": "Publicar ou atualizar parada",
    "/api/lastfm/import": "Importar parada do Last.fm",
    "/api/spotify/search": "Buscar músicas no Spotify",
    "/api/spotify/cover": "Buscar capa de álbum",
    "/api/criticsfm/search-spotify": "Buscar álbum (CriticsFM)",
    "/api/admin/spotify-status": "Checagem de status do Spotify",
    "/api/admin/crownnote-export": "Exportar Crownnote",
    "/api/internal/log-request": "Registro interno de log",
    "/api/cron/nightly-catalog-backfill": "Completar catálogo (noite)",
    "/api/cron/global-lastfm": "Atualizar ranking global Last.fm",
    "/api/cron/publish-weekly-globals": "Publicar paradas globais da semana",
    "/api/cron/release-radar": "Radar de lançamentos",
    "/api/cron/release-radar-import": "Importar lançamentos do radar",
    "/api/cron/mytrl": "Atualizar MyTRL",
    "/api/cron/mytrl-weekly": "MyTRL semanal",
    "/api/cron/backfill-covers": "Completar capas faltantes",
    "/api/cron/analytics-rollup": "Resumo de analytics",
    "/api/cron/copa-advance": "Avançar Copa",
    "/api/cron/clube-advance": "Avançar Clube",
    "/api/cron/push-advance": "Avançar Push",
  };
  if (exact[p]) return exact[p];

  if (p.startsWith("/api/cron/")) {
    const name = p.slice("/api/cron/".length).replace(/-/g, " ");
    return `Tarefa automática: ${name}`;
  }
  if (p.startsWith("/api/admin/")) {
    const name = p.slice("/api/admin/".length).replace(/-/g, " ");
    return `Admin: ${name}`;
  }
  if (/^\/api\/charts\/[^/]+$/.test(p)) return "Editar parada existente";
  if (p.startsWith("/api/charts/")) return "Ação em parada";
  if (p.startsWith("/api/spotify/")) return "Ação ligada ao Spotify";
  if (p.startsWith("/api/lastfm/")) return "Ação ligada ao Last.fm";
  if (p.startsWith("/api/")) return `Chamada interna (${p.replace(/^\/api\//, "")})`;
  return p;
}

/** Descreve o endpoint da API do Spotify. */
export function friendlySpotifyEndpoint(endpoint: string): string {
  const map: Record<string, string> = {
    "/search": "Busca de músicas/artistas",
    "/tracks/{id}": "Detalhes de uma música",
    "/albums/{id}": "Detalhes de um álbum",
    "/albums/{id}/tracks": "Faixas de um álbum",
    "/artists/{id}": "Detalhes de um artista",
    "/artists/{id}/albums": "Álbuns de um artista",
    "/artists/{id}/top-tracks": "Top músicas de um artista",
    token: "Login/token do Spotify",
    "browser-token": "Token enviado ao navegador",
  };
  if (map[endpoint]) return map[endpoint];
  if (endpoint.startsWith("/tracks")) return "Consulta de músicas";
  if (endpoint.startsWith("/albums")) return "Consulta de álbuns";
  if (endpoint.startsWith("/artists")) return "Consulta de artistas";
  if (endpoint.startsWith("/search")) return "Busca";
  return endpoint;
}

/** Descreve a função interna que disparou a chamada. */
export function friendlySpotifyCaller(caller: string): string {
  const map: Record<string, string> = {
    searchSpotifyTracks: "Buscar músicas",
    searchSpotifyAlbums: "Buscar álbuns",
    searchSpotifyArtist: "Buscar artista",
    getSpotifyTrackMetadataById: "Carregar dados da música",
    getSpotifyAlbumMetadataById: "Carregar dados do álbum",
    getSpotifyAlbumDetails: "Detalhes completos do álbum",
    getSpotifyArtistById: "Carregar dados do artista",
    listSpotifyAlbumTracks: "Listar faixas do álbum",
    fetchSpotifyTrackCovers: "Buscar capas",
    resolveCoverImageUrl: "Resolver URL da capa",
    probeSpotifyApi: "Teste de conexão",
    waitForSpotifyApi: "Esperar API liberar",
    desconhecido: "Origem não identificada",
  };
  if (map[caller]) return map[caller];
  // camelCase → frase
  const spaced = caller
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/_/g, " ")
    .trim();
  return spaced || caller;
}

export function friendlySpotifyApp(app: string): string {
  switch (app) {
    case "primary":
      return "App principal";
    case "backup":
      return "App reserva";
    case "backup2":
      return "App reserva 2 (paradas)";
    case "backup3":
      return "App reserva 3 (Crownnote + backfill)";
    case "token":
      return "Autenticação";
    case "browser":
      return "Navegador";
    default:
      return app;
  }
}

export function friendlyBudgetCategory(category: string): string {
  switch (category) {
    case "radar":
      return "Radar de lançamentos";
    case "backfill":
      return "Completar catálogo";
    case "mytrl":
      return "MyTRL";
    case "admin":
      return "Ferramentas admin";
    case "lastfm":
      return "Rankings Last.fm";
    default:
      return category;
  }
}

/** Frase curta sobre consumo (ex.: "12 consultas · 2 lentas"). */
export function consumptionPlainSummary(opts: {
  totalCalls: number;
  total429: number;
  avgDurationMs?: number | null;
}): string {
  const parts = [
    opts.totalCalls === 1
      ? "1 consulta ao Spotify"
      : `${opts.totalCalls} consultas ao Spotify`,
  ];
  if (opts.total429 > 0) {
    parts.push(
      opts.total429 === 1
        ? "1 vez o Spotify pediu para esperar"
        : `${opts.total429} vezes o Spotify pediu para esperar`,
    );
  }
  if (opts.avgDurationMs != null && opts.avgDurationMs > 0) {
    parts.push(`média de ${Math.round(opts.avgDurationMs)} ms por consulta`);
  }
  return parts.join(" · ");
}
