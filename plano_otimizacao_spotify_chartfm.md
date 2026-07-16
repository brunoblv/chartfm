# Plano Estratégico de Otimização da Spotify API --- ChartFM

> **Status (2026-07-16): implementado** — Fases 1 e 2 completas; Fase 3 feita
> em memória no processo (sem Redis: pm2 roda 1 processo, um Map resolve);
> Fase 4 com orçamento diário (`lib/spotify-budget.ts`) integrado ao Release
> Radar e exposto no `/admin/logs` (o dashboard/log já existia em
> `lib/spotify-usage-log.ts`). Detalhes no fim do arquivo.

## Objetivo

Reduzir drasticamente os erros HTTP 429, diminuir o consumo da Spotify
API e preparar o ChartFM para crescer sem depender diretamente da API.

## Diagnóstico

O problema não é o volume diário de chamadas, mas sim o perfil das
chamadas: rajadas em horários específicos, chamadas redundantes,
ausência de cache compartilhado, consultas diretas do navegador e falta
de uma camada centralizada de rate limiting.

### Problemas prioritários

1.  **Busca direta do navegador para a Spotify API**

-   Eliminar completamente.
-   Todo acesso deve passar pelo backend.
-   Implementar cache compartilhado e deduplicação.

2.  **upsertSongFromSpotify**

-   Não consultar novamente músicas completas.
-   Criar conceito de Catálogo Confiável.
-   Atualizar apenas após 180 dias ou refresh manual.

3.  **Cache de buscas**

-   Aumentar TTL de 5 minutos para 30--60 dias.
-   Aumentar tamanho do cache.

4.  **Atualização de artistas**

-   Atualizar apenas a cada 30 dias.

5.  **SSR**

-   Nunca consultar Spotify durante a renderização.
-   Ler sempre do banco.
-   Atualizações em background.

6.  **Backfills**

-   Processar orçamento diário fixo (ex.: 50 registros/dia).

## Arquitetura recomendada

    Usuário
        ↓
    SpotifyGateway
        ↓
    Rate Limiter
        ↓
    Retry
        ↓
    Redis
        ↓
    Banco
        ↓
    Spotify API

Nenhum serviço deve acessar diretamente a Spotify API.

## Redis

Adicionar Redis para cache em memória.

## Lock distribuído

Se vários usuários solicitarem o mesmo recurso, apenas uma chamada deve
chegar à Spotify.

## Orçamento diário

Exemplo: - Busca: 300 - MyTRL: 100 - Release Radar: 250 - Backfill:
150 - Admin: 50 - Reserva: 150

Quando um orçamento acabar, apenas tarefas secundárias devem parar.

## Dashboard

Criar tabela `spotify_request_log` com: - endpoint - entity - entityId -
caller - cacheHit - duration - status - retry - createdAt

## Ordem de implementação

### Fase 1

-   Remover busca direta do navegador.
-   Aumentar TTL do cache.
-   Implementar upsert inteligente.
-   Batch de artistas.

### Fase 2

-   SpotifyGateway.
-   Rate Limiter.
-   Retry.
-   Fila única.

### Fase 3

-   Redis.
-   Lock distribuído.
-   Cache de artistas.
-   Cache de álbuns.

### Fase 4

-   Orçamento diário.
-   Dashboard.
-   Estatísticas por endpoint.
-   Alertas.

## Estimativa de redução

  Alteração                               Redução
  ----------------------------- -----------------
  Busca pelo servidor + cache             70--95%
  Upsert inteligente                        \~90%
  Cache de artistas                         \~95%
  Lock distribuído                          \~80%
  Batch de artistas                         \~70%
  Gateway + orçamento             elimina rajadas

## Mudança conceitual

A Spotify deve ser tratada apenas como uma fonte de ingestão de dados.

Fluxo recomendado:

    Spotify
        ↓
    Banco do ChartFM
        ↓
    Frontend

Depois que um artista, álbum ou música entra no banco, todas as páginas
devem utilizar o catálogo local. A Spotify passa a ser usada apenas para
enriquecimento e atualizações assíncronas, reduzindo drasticamente o
risco de erros 429 e preparando o ChartFM para escalar.

## Implementação (2026-07-16)

### O que foi feito

1. **Busca direta do navegador eliminada** — `/api/spotify/search` não
   entrega mais tokens; a rota complementa o catálogo local com
   `searchSpotifyTracks` no servidor (cache compartilhado + dedup).
   `useSpotifySearch` e `copa-song-search-client` viraram uma única
   chamada ao backend; `markPrimaryLimited` (só existia pro browser
   reportar 429) foi removida.
2. **Gateway/rate limiter** — `spotifyFetch` já era o ponto único
   (retry + failover backup + log); ganhou espaçamento global de 250ms
   entre chamadas (elimina rajadas) e `dedupeInFlight` (chamadas
   idênticas simultâneas compartilham 1 request — o "lock distribuído",
   em processo, já que o pm2 roda 1 processo; Redis desnecessário).
3. **Caches** — busca: TTL 5min → 30 dias, 200 → 5000 entradas; perfil
   de artista: cache novo de 30 dias (3000 entradas); metadados de
   faixa: cache novo de 1h (repetições de publicação).
4. **Upsert inteligente** — `upsertSongFromSpotifyMetadata` pula a
   chamada `/artists/{id}` e a reescrita quando o artista já está
   completo (foto + gêneros) e atualizado há <30 dias. Push submit
   resolve 100% do catálogo local quando a música já existe com álbum
   e data de lançamento (zero chamadas).
5. **Orçamento diário** — `lib/spotify-budget.ts` (radar 250,
   backfill 150, mytrl 100, admin 50/dia, em memória); integrado ao
   Release Radar (para a varredura ao estourar, retoma no dia
   seguinte) e exposto em `/api/admin/spotify-status?target=usage`
   (campo `budgets`) para o /admin/logs. Fluxos interativos nunca são
   bloqueados por orçamento.

### Pendente / próximo

- Ligar `tryConsumeSpotifyBudget("backfill")` nos backfills em lote
  (missing-info, edicao-de-dados) e `"mytrl"` no MyTRL, se necessário —
  hoje backfill-covers e nightly-catalog-backfill já estão desativados.
- Redis/lock distribuído só se o app passar a rodar em múltiplos
  processos.
- SSR: único ponto que ainda consulta Spotify na renderização é a
  página de artista sem linha no banco e sem snapshot (caso raro de
  primeira visita) — mantido.
