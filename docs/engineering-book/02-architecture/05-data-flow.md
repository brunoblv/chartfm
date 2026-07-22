# Capítulo 11 — Fluxo de Dados

> **ChartFM Engineering Book**
> **Versão:** 1.0
> **Status:** Draft Oficial

---

# Objetivo

Mostrar, de ponta a ponta, como os dados se movem pelo ChartFM — desde a ação do usuário até os agregados que alimentam outras partes do produto.

---

# Fluxo 1 — Publicar uma Chart

```text
Usuário monta/publica uma Parada na UI
        ↓
API route (app/api/.../route.ts) valida e autentica
        ↓
lib/paradas.ts, lib/chart-entry-points.ts calculam pontos e persistem
        ↓
Parada + Chart + ChartEntry gravados via Prisma
        ↓
Efeitos colaterais:
  - Notification para seguidores
  - AnalyticsEvent registrado
  - Entrada no Feed
  - Elegível para agregação em GlobalSnapshot / DailyChartSongStats
```

---

# Fluxo 2 — Rollups e Snapshots

Dados brutos (charts, reviews, eventos) são agregados periodicamente em snapshots para evitar recomputar queries pesadas a cada request:

```text
Dados brutos (Chart, ChartEntry, AnalyticsEvent, ...)
        ↓
Scripts/jobs de agregação (lib/global-snapshot.ts, lib/analytics-rollup.ts,
lib/entity-page-snapshot/, lib/daily-chart-song-stats.ts)
        ↓
Snapshots persistidos (GlobalSnapshot, AnalyticsDailyStat, EntityPageSnapshot, DailyChartSongStats)
        ↓
Páginas e Discover leem o snapshot, não os dados brutos
```

Isso é o mesmo padrão de "agregação cara vira snapshot" descrito no [Capítulo 9 — Modelo de Domínio](03-domain-model.md). Quando um número exibido na plataforma parece "desatualizado" propositalmente, geralmente é porque ele vem de um snapshot com sua própria cadência de atualização, não de uma query ao vivo.

---

# Fluxo 3 — Discover e Recomendações

```text
Sinais de entrada:
  - UserFollow (rede social)
  - Charts recentes do usuário e de quem ele segue
  - SongRecommendation e reviews
  - Snapshots de afinidade/curadoria (CuratorsSnapshot)
        ↓
lib/recommendations-feed.ts, lib/home-mixed-feed.ts combinam os sinais
        ↓
Resultado misto exibido em Discover/Feed
```

---

# Fluxo 4 — Integrações Externas de Catálogo

```text
Provedor externo (Spotify / Deezer / YouTube / MusicBrainz / Last.fm)
        ↓
lib/spotify-server.ts, lib/deezer.ts, lib/lastfm.ts, lib/musicbrainz.ts, etc.
        ↓
Reconciliação/upsert em Artist, Album, Song (lib/upsert-song-from-spotify-metadata.ts,
lib/apply-spotify-metadata-to-*.ts)
        ↓
Catálogo interno atualizado, consumido por todos os módulos de produto
```

Esse fluxo é assíncrono em relação à navegação do usuário sempre que possível — falha ou lentidão de um provedor externo não deve travar a experiência de quem está usando a plataforma no momento.

---

# Fluxo 5 — Auditoria de Requisição

```text
Requisição autenticada chega em middleware.ts
        ↓
Nome/handle do usuário logado é percent-encoded (encodeURIComponent) e
repassado via header para a API route
        ↓
API route decodifica (decodeURIComponent, dentro de try/catch) via
lib/api-call-context.ts
        ↓
ApiRequestLog / SiteAuditLog gravados com o contexto do usuário
```

Este é o fluxo do gotcha documentado no `CLAUDE.md`: pular o encode/decode aqui derruba com 500 toda chamada de API do usuário autenticado assim que ele tiver um caractere fora de Latin-1 no nome. Ver [Capítulo 8](02-system-architecture.md).

---

# Conclusão

Três padrões se repetem em todo fluxo de dados do ChartFM: (1) toda ação relevante do usuário se propaga para notificação, Analytics e Feed; (2) agregações caras viram snapshots persistidos, nunca recomputação ao vivo; (3) integrações externas nunca bloqueiam a experiência principal. Ao desenhar um novo fluxo, valide contra esses três padrões antes de implementar algo diferente.
