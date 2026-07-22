# Capítulo 9 — Modelo de Domínio

> **ChartFM Engineering Book**
> **Versão:** 1.0
> **Status:** Draft Oficial

---

# Objetivo

Descrever as entidades centrais do modelo de dados (`prisma/schema.prisma`) e como elas se relacionam. Este capítulo não substitui o schema — é o mapa conceitual que ajuda a navegar nele.

---

# Catálogo Musical

- **Artist**, **Album**, **Song** — entidades de catálogo, identificadas primariamente por `spotifyId` e reconciliadas com MusicBrainz quando necessário (MBIDs).
- **SongFeat** — participações/features entre músicas e artistas.
- **SongFlag** — sinalizações de problema em uma música (ex.: metadado incorreto), usadas no fluxo de moderação/correção de catálogo.

O catálogo é compartilhado por toda a plataforma: uma `Song` referenciada em uma Chart é a mesma referenciada em uma Review, uma Recomendação ou uma Copa.

---

# Identidade e Rede Social

- **User** — conta do usuário, com `handle` único.
- **UserFollow** — relação de seguir entre usuários (`followerId` → usuário seguido), base do Feed e do Discover social.
- **Notification** — notificações direcionadas a um `recipientId`.

---

# Charts

- **Parada** — a publicação semanal ou diária de um usuário; contém metadados do período e do dono.
- **Chart** — o ranking em si, associado a uma `Parada` e a um `userId`.
- **ChartEntry** — cada posição do ranking, referenciando uma `Song`.
- **ChartLike**, **ChartRepost** — interações sociais sobre uma chart.
- **ParadaComment**, **ParadaCommentLike** — comentários em uma parada, opcionalmente escopados a uma `Community`.

Uma `Parada` pode pertencer a um usuário individual ou estar associada a uma `Community` — é assim que Charts de comunidade e Charts pessoais compartilham a mesma modelagem.

---

# Comunidades

- **Community**, **CommunityMember** — grupo e seus membros.
- **AlbumClubRound**, **AlbumClubNomination**, **AlbumClubPollVote**, **AlbumClubWinner** — ciclo mensal de indicação → votação → vencedor do Clube do Álbum, rodando dentro de uma comunidade.
- **CommunityLastfmSnapshot** — dados agregados de Last.fm específicos de uma comunidade.

---

# Reviews e Recomendações

- **AlbumReview**, **AlbumReviewHelpful** — review de álbum e votos de utilidade.
- **SongRecommendation**, com **SongRecommendationLike**, **SongRecommendationComment** (e suas réplicas/likes) — recomendações pontuais de música, com sua própria árvore de interação social, independente de Charts.

---

# Jogos

- **PushRound**, **PushSubmission**, **PushVote** — rodadas de submissão e votação do Push.
- **CopaEdition**, **CopaDayPlaylist**, **CopaParticipant**, **CopaArtist**, **CopaSingle**, **CopaFixture**, **CopaVote**, **CopaAutoVoteQueue**, **CopaLiveComment** — estrutura de torneio eliminatório da Copa, incluindo comentários ao vivo durante as partidas.
- **WeeklySpotlightPoll**, **WeeklySpotlightOption**, **WeeklySpotlightNomination**, **WeeklySpotlightVote** — votação semanal em destaque.

---

# Rankings Globais e Snapshots

- **GlobalSnapshot**, **GlobalAirplaySnapshot**, **GlobalAlbumsSnapshot**, **GlobalGenreSnapshot** — estados agregados e imutáveis da plataforma em um determinado período (ex.: `weekIndex`).
- **EntityPageSnapshot** — snapshot pré-calculado usado para renderizar páginas de entidade (artista/álbum/música) sem recomputar agregações pesadas a cada request.
- **DailyChartSongStats**, **CuratorsSnapshot** — estatísticas diárias derivadas de charts publicadas.
- **MyTrlSnapshot** — snapshot específico do modo MyTRL.

O padrão geral: sempre que uma agregação é cara de calcular e consumida com frequência, ela vira um snapshot persistido em vez de ser recalculada em tempo real. Ver [Capítulo 11 — Fluxo de Dados](05-data-flow.md).

---

# Editorial e Sistema

- **WeeklyEditorial**, **EditorialPost**, **EditorialPostDailyView** — conteúdo curado e suas métricas de visualização.
- **SystemFeedPost**, **ScheduledAnnouncement** — comunicação da plataforma para os usuários, incluindo anúncios agendados.
- **SupportTicket**, **SupportTicketMessage** — suporte ao usuário.

---

# Observabilidade e Auditoria

- **ApiRequestLog**, **SiteAuditLog**, **SystemErrorLog** — logs de requisição, auditoria e erro. Alimentados via `middleware.ts` e a camada de API (ver [Capítulo 8](02-system-architecture.md) sobre o cuidado com encoding de headers).
- **AnalyticsEvent**, **AnalyticsDailyStat** — eventos brutos de produto e seus rollups diários. Ver [Capítulo 10 — Arquitetura de Eventos](04-event-architecture.md).

---

# Conclusão

O modelo de domínio do ChartFM segue uma regra simples: entidades de catálogo (Artist/Album/Song) são compartilhadas por todos os módulos; cada módulo de produto (Charts, Reviews, Jogos, Comunidades) constrói sua própria camada de interação social em cima delas; e agregações caras viram snapshots explícitos em vez de queries recalculadas.
