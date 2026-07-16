# 🎬 Funcionalidade de Video Clipes do YouTube

## Visão Geral

Sistema automático de busca e atribuição de video clipes oficiais do YouTube para músicas, excluindo lyrics videos, visualizers e áudio-only.

## Arquitetura

### Arquivos Criados

#### Backend

1. **`lib/youtube-music-clip-backfill.ts`** (Serviço de lógica)
   - `searchAndCreateYouTubeClip()`: Busca e cria clipe para uma música
   - `findSongsWithoutClips()`: Encontra músicas sem clipes
   - `countSongsWithoutClips()`: Conta músicas sem clipes
   - `createManualReviewFlag()`: Marca para revisão manual

2. **`app/api/admin/songs/backfill-youtube-clips/route.ts`** (API em lote)
   - `GET`: Retorna total de músicas sem clipes + amostra
   - `POST`: Processa lote de músicas (até 30 por requisição)
   - Aceita `excludeSongIds` e `markForReview` no payload
   - Retorna: `processed`, `found`, `needsReview`, `errors`, `remaining`, `failedItems`

3. **`app/api/admin/songs/[songId]/youtube-clip/route.ts`** (API individual)
   - `POST`: Busca clipe para uma música específica
   - Retorna: `found`, `videoId`, `title`, `publishedAt`, ou `needsManualReview`

#### Frontend

4. **`app/admin/songs/youtube-clips/page.tsx`** (Página de admin)
   - Interface principal do gerenciador de clipes
   - Exibe total de músicas pendentes
   - Link: `/admin/songs/youtube-clips`

5. **`app/admin/songs/youtube-clips/YouTubeClipsBackfillClient.tsx`** (Componente para lote)
   - Executa backfill com progresso em tempo real
   - Mostra: encontrados, marcados para revisão, erros
   - Painel para rever e selecionar músicas manualmente
   - Tratamento de rate limiting e retry automático

6. **`app/admin/dados/YouTubeClipFetchButton.tsx`** (Botão individual)
   - Botão "YT CLIP" integrado na tabela de edição de músicas
   - Busca clipe para 1 música de cada vez
   - Aparece junto com botões de LFM, SPT, MB, WIKI

#### Integrações

7. **`app/admin/dados/DataSearchClient.tsx`** (Edição)
   - Adicionado import e renderização de `YouTubeClipFetchButton`
   - Botão aparece na coluna de "Ações" para cada música

8. **`app/admin/dados/musicas/page.tsx`** (Navegação)
   - Link adicionado: "Video Clipes (YouTube)"

## Fluxo de Uso

### Modo Lote (Backfill Automático)

1. Acesse `/admin/songs/youtube-clips`
2. Clique em "Iniciar Backfill"
3. Sistema processa em lotes de 30 músicas
4. Para cada música:
   - Se encontrar clipe oficial → cria `SongVideoClip` com type "OFFICIAL"
   - Se não encontrar → marca para revisão manual (nota editorial)
   - Se erro → lista em "failedItems"
5. Pause/continue manualmente ou deixe rodar completamente
6. Músicas marcadas para revisão aparecem num painel
   - Admin pode selecionar e pular para próximas

### Modo Individual (Edição)

1. Em `/admin/dados/musicas`, busque uma música
2. Clique no botão "YT CLIP" (vermelho)
3. Sistema busca e cria clipe para aquela música
4. Resultado aparece inline (clipe encontrado ou marcado para revisão)

## Critérios de Filtro

### O que INCLUI (pontuação positiva)

- `official music video`: +6 pts
- `music video`: +5 pts
- `official video`: +4 pts
- `video`: +2 pts
- Canal oficial (VEVO ou nome do artista): +8 pts
- Título contém nome do artista: +2 pts

### O que EXCLUI (pontuação negativa)

- Lyric video / lyrics video: -100 pts
- Visualizer / visualiser: -50 pts
- Hour loop / 1 hour: -50 pts
- Official audio: -50 pts
- Audio only: -50 pts
- Fan upload / HQ / [HD]: -100 pts
- Bootleg: -100 pts
- Live performance / Concert / Interview: -50 pts

### Ordem de Busca

1. `"{artista} {música} official music video"`
2. `"{artista} - {música} music video"`
3. `"{artista} {música} official video"`
4. `"{artista} {música} video"`

### Seleção Final

- Confiáveis (canal oficial + score alto) têm prioridade
- Se nenhum confiável → usa o melhor score geral
- Entre os melhores, escolhe o mais antigo (lançamento original)

## Banco de Dados

### Modelo SongVideoClip (já existe)

```prisma
model SongVideoClip {
  id          String                    @id @default(cuid())
  songId      String                    @map("song_id")
  uploadedBy  String                    @map("uploaded_by")  // Admin user ID
  youtubeId   String?                   @map("youtube_id")
  imageUrl    String                    @map("image_url")    // maxresdefault
  publishedAt DateTime?                 @map("published_at") // Data do vídeo no YT
  clipType    ClipType                  @default(OFFICIAL)   // OFFICIAL, LYRIC_VIDEO, VISUALIZER, LIVE, OTHER
  votes       Int                       @default(0)
  createdAt   DateTime                  @default(now())
  
  @@index([songId])
  @@map("song_video_clips")
}

enum ClipType {
  OFFICIAL
  LYRIC_VIDEO
  VISUALIZER
  LIVE
  OTHER
}
```

### Campo para Revisão Manual

- Usa `Song.sourcesNotFound` com o valor `"youtube_clip"` (mesmo padrão das fontes Spotify/Last.fm/MusicBrainz/Wikipedia)
- Músicas marcadas são puladas pelo backfill (não gastam quota de novo); encontrar um clipe limpa a marcação
- Histórico: antes a flag era anexada em `Song.editorialNote` como `[CLIP_REVIEW_NEEDED] ...`, o que duplicava a cada rodada e vazava na página pública da música — corrigido em 2026-07-16 (`scripts/clean-clip-review-flags.ts` limpa os dados antigos)

## Configuração de Ambiente

Requer variável configurada:

```env
YOUTUBE_API_KEY=sua-chave-aqui
```

- Obtida em: [Google Cloud Console](https://console.cloud.google.com)
- API necessária: YouTube Data API v3
- Quota: ~500 requestspor dia por chave (busca + metadata)

## Comportamento de Taxa de Requisições

O endpoint de API respeita o rate limiting do YouTube:

- Budget por requisição: 35 segundos
- Max batch: 30 músicas
- Se YouTube retornar 429: aguarda e tenta novamente
- Max 3 tentativas consecutivas falhadas antes de parar

## Integração com Sistema Existente

### Reutiliza

- `getYouTubeMusicVideoReleaseDate()` de `youtube-music-video-date.ts`
  - Já tem lógica robusta de filtro e scoring
  - Já busca em múltiplas queries com fallback
  - Já normaliza títulos para matching

### Não conflita com

- `musicVideoReleaseDate` (campo de data do videoclipe no YouTube)
- `youtubeReleaseDate` (campo de data de lançamento no YouTube)
- Sistema de votação de clipes (`SongVideoClipVote`)
- Escolha do usuário (`UserSongVideoClipChoice`)

## Tratamento de Erros

### Cenários

1. **API YouTube indisponível**: Retorna erro, admin pode tentar depois
2. **Música não encontrada**: Marca para revisão manual
3. **Clipe já existe**: Ignora (não duplica)
4. **Timeout**: Lote adia para próxima requisição (não contabilizado como erro)

### Failover

- Se `YOUTUBE_API_KEY` não configurada: endpoint retorna erro 400
- Admin vê mensagem clara pedindo para configurar variável

## Performance

- **Lote**: ~30 músicas em 35 segundos (limite de timeout)
- **Individual**: ~2-5 segundos por música
- **Rate**: ~1.7k músicas/dia (com 500 requisições limite do YouTube)

## Próximas Melhorias Opcionais

- [ ] Admin escolher entre múltiplos clipes encontrados
- [ ] Filtro por tipo de clipe (oficial, lyric, live, etc)
- [ ] Dashboard de estatísticas (% com clipes, tempo médio busca)
- [ ] Fila persistente de busca (Prisma queue ou Redis)
- [ ] Webhook para notificar quando clipes forem encontrados
- [ ] Integração com edição inline de `publishedAt` do clipe

## Comandos Úteis (Admin)

### Via CLI local

```bash
# Testar busca para uma música
curl -X POST http://localhost:3000/api/admin/songs/cuid123/youtube-clip \
  -H "Content-Type: application/json"

# Testar lote (primeira página)
curl -X POST http://localhost:3000/api/admin/songs/backfill-youtube-clips \
  -H "Content-Type: application/json" \
  -d '{"limit": 5}'

# Checar quantas faltam
curl http://localhost:3000/api/admin/songs/backfill-youtube-clips
```

## FAQ

**P: Por que o clipe está marcado como OFFICIAL se é um lyric video?**
R: Verifique o `clipType` na tabela. Se estiver errado, admin pode editar via banco ou criar novo clipe manualmente.

**P: Posso filtrar por idioma do canal?**
R: Não atualmente, mas a função de scoring já prioriza canais confiáveis (VEVO, artista oficial).

**P: O que acontece se a música não tem clipe oficial?**
R: É marcada para revisão manual em `sourcesNotFound` (`"youtube_clip"`) e o backfill passa a pulá-la. Admin pode then escolher entre:
- Pular/ignorar
- Marcar como "sem clipe"
- Buscar manualmente e criar entrada

**P: Posso excluir um clipe?**
R: Ainda não implementado. Para agora, contact DB ou crie issue para soft-delete.
