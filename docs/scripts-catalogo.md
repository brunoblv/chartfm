# Scripts de catálogo: backfill, import e enriquecimento

Inventário dos scripts e fluxos que **enriquecem o catálogo** (e o que importa paradas/histórico junto).

## Pré-requisitos comuns

| Variável / recurso | Uso |
|--------------------|-----|
| `DATABASE_URL` | Postgres (via `.env`) |
| `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET` | Capas, lookup, MyTRL |
| `MUSICBRAINZ_DATABASE_URL` | Backfills locais MusicBrainz |
| `CRON_SECRET` + `APP_BASE_URL` | Crons HTTP |
| Last.fm API key | Paradas de gênero / Global |

A maioria dos CLIs aceita `--dry-run` para simular sem gravar.

---

## Aliases no `package.json`

| Script | O que faz | Como rodar |
|--------|-----------|------------|
| `db:seed` | Seed de dev (users, paradas, songs) | `npm run db:seed` |
| `seed:boofrnds` | Importa histórico @boofrnds | `npm run seed:boofrnds` |
| `seed:clube-r3` | Seed Clube do Álbum rodada 3 | `npm run seed:clube-r3` |
| `backfill:song-covers` | Capas via Spotify | `npm run backfill:song-covers` |
| `backfill:recording-mbid` | `recording_mbid` via MB local | `npm run backfill:recording-mbid` |
| `import:single-release-dates-2000s` | Datas de single da planilha `public/2000s.xlsx` | `npm run import:single-release-dates-2000s` |
| `fix:spotify-entries` | Corrige matches Spotify errados | `npm run fix:spotify-entries` |
| `mytrl:month` | Gera MyTRL/UMS de um mês | `npm run mytrl:month -- --month=janeiro --year=2026 --playlist=...` |
| `rebuild:global-2026` | Rebuild snapshots globais 2026 | `npm run rebuild:global-2026` |
| `refresh:entity-snapshots` | Refresh snapshots de páginas de entidade | `npm run refresh:entity-snapshots` |

---

## Enriquecimento de metadados (Song)

| Arquivo | O que faz | Como executar |
|---------|-----------|---------------|
| `scripts/backfill-song-covers.ts` | Capas/álbum Spotify para songs sem cover | `npm run backfill:song-covers` · flags: `--dry-run --limit=50 --search` |
| `scripts/backfill-song-covers-vps.sh` | Wrapper do mesmo na VPS | `./scripts/backfill-song-covers-vps.sh` |
| `scripts/backfill-recording-mbid.ts` | Preenche `recording_mbid` (MB local) | `npm run backfill:recording-mbid` · `--dry-run --limit=100 --force` |
| `scripts/backfill-single-release-date.ts` | Datas single/clipe via MB (precisa mbid) | `npx tsx scripts/backfill-single-release-date.ts [--dry-run\|--limit=100]` |
| `scripts/backfill-song-tags-dates-local.ts` | mbid + tags/gêneros + datas (só MB local) | `npx tsx scripts/backfill-song-tags-dates-local.ts [--dry-run\|--limit=100]` |
| `scripts/import-single-release-dates-2000s.ts` | `singleReleaseDate` de `public/2000s.xlsx` | `npm run import:single-release-dates-2000s` · `--dry-run --force` |
| `scripts/import-billboard-hot100-debut-dates.ts` | Debut Hot 100 a partir do JSON Billboard | `npx tsx scripts/import-billboard-hot100-debut-dates.ts [--dry-run]` |
| `scripts/import-billboard-genre-charts-debut-dates.ts` | Debut em charts de gênero Billboard | `npx tsx scripts/import-billboard-genre-charts-debut-dates.ts [--dry-run]` |
| `scripts/add-songs-by-spotify-url.ts` | Upsert de músicas por URL Spotify (hardcoded no arquivo) | `npx tsx scripts/add-songs-by-spotify-url.ts` |
| `scripts/fix-wrong-spotify-entries.ts` | Corrige Spotify IDs errados | `npm run fix:spotify-entries` · `--dry-run --handle=...` |

### Scrape / helpers

```bash
# Billboard genre charts → JSON em scripts/data/billboard-genre-charts/
python scripts/billboard-genre-charts-scrape.py --chart hot-mainstream-rock-tracks --start 1990-01-01

# Lookup pontual Bugs
npx tsx scripts/bugs-lookup.ts "Hype Boy" "NewJeans"

# Probe API Spotify (429 / auth)
npx tsx scripts/spotify-probe.ts
```

Deps Python do scrape: `requests`, `beautifulsoup4`.

---

## Import / seed de paradas históricas

| Arquivo | O que faz | Como executar |
|---------|-----------|---------------|
| `scripts/seed-boofrnds.ts` | Charts @boofrnds (`public/boofrnds/*.txt`) | `npm run seed:boofrnds` · `--dry-run --skip-spotify --patch-songs` |
| `scripts/seed-brunurbano-lado-b.ts` | LADO B @brunurbano | Parse: `python scripts/parse-lado-b-xlsx.py <xlsx>` → `npx tsx scripts/seed-brunurbano-lado-b.ts [--xlsx=...]` |
| `scripts/import-under-my-skin-top20.ts` | Under My Skin Video @bruno | `npx tsx scripts/import-under-my-skin-top20.ts [--dry-run]` |
| `scripts/import-leoxavier-top30.ts` | TOP 30 @leoxavier | `npx tsx scripts/import-leoxavier-top30.ts [--dry-run --skip-spotify]` |
| `scripts/import-leoxavier-2025.ts` | Lacuna 2025 @leoxavier | `npx tsx scripts/import-leoxavier-2025.ts [--dry-run]` |
| `scripts/import-rafizaka-fifofu.ts` | Fifofu @rafizaka | `npx tsx scripts/import-rafizaka-fifofu.ts [--dry-run]` |
| `scripts/import-otiagoqz-crownnote.ts` | Personal Chart @otiagoqz | `npx tsx scripts/import-otiagoqz-crownnote.ts [--dry-run]` |
| `scripts/import-ohmymog-mgold.ts` | MGOLD @ohmymog_ | Parse: `python scripts/parse-mgold-xlsx.py <xlsx>` → `npx tsx scripts/import-ohmymog-mgold.ts` |
| `scripts/import-ucc-parada.ts` | UCC comunidade | Parse: `python scripts/parse-ucc-xlsx.py <xlsx>` → `npx tsx scripts/import-ucc-parada.ts` |
| `scripts/export-ucc-prod-sql.ts` | Exporta SQL de prod da UCC | `npx tsx scripts/export-ucc-prod-sql.ts [--out=scripts/ucc-prod-import.sql]` |
| `scripts/redo-ucc-short-weeks.ts` | Refaz semanas curtas UCC | `npx tsx scripts/redo-ucc-short-weeks.ts [--dry-run --threshold=20]` |
| `scripts/seed-ums-hot-100-parada.ts` | Cria parada UMS Hot 100 | `npx tsx scripts/seed-ums-hot-100-parada.ts` |
| `scripts/generate-ums-live-request-daily.ts` | Top 10 diários UMS Live Request | `npx tsx scripts/generate-ums-live-request-daily.ts [--dry-run --week=...]` |

Migrações de charts (movem histórico, não enriquecem metadados):

```bash
npx tsx scripts/migrate-ums-parada.ts [--dry-run]
npx tsx scripts/migrate-mytrl-to-ums.ts [--dry-run]
npx tsx scripts/migrate-ucc-to-community-parada.ts [--dry-run]
```

---

## MyTRL / Global Last.fm / paradas de gênero

| Arquivo | O que faz | Como executar |
|---------|-----------|---------------|
| `scripts/backfill-mytrl.ts` | Regenera snapshots MyTRL diários | `npx tsx scripts/backfill-mytrl.ts [from] [to]` |
| `scripts/backfill-mytrl-weekly.ts` | Publica charts semanais MyTRL | `npx tsx scripts/backfill-mytrl-weekly.ts` |
| `scripts/run-mytrl-month.ts` | Gera MyTRL de um mês (playlist Spotify) | `npm run mytrl:month -- --month=... --year=... --playlist=...` |
| `scripts/run-mytrl-today.ts` | Gera MyTRL do dia | `npx tsx scripts/run-mytrl-today.ts [--date=YYYY-MM-DD]` |
| `scripts/seed-global-lastfm-june-2026.ts` | Popula Global Last.fm | `npx tsx scripts/seed-global-lastfm-june-2026.ts [--mode=albums\|airplay]` |
| `scripts/rebuild-global-lastfm-snapshots.ts` | Rebuild snapshots Global | `npx tsx scripts/rebuild-global-lastfm-snapshots.ts [--dry-run]` |
| `scripts/create-genre-paradas.ts` | Cria paradas de estilo (Last.fm) | `npx tsx scripts/create-genre-paradas.ts [--dry-run --only=keku]` |
| `scripts/fill-genre-paradas-from-global100.ts` | Preenche slots vazios com Global 100 | `npx tsx scripts/fill-genre-paradas-from-global100.ts [--prod]` |
| `scripts/fill-the-hits-from-global100.ts` | Idem para “The Hits” | `npx tsx scripts/fill-the-hits-from-global100.ts [--prod]` |
| `scripts/backfill-genre-parada-decay-flags.ts` | Flags `autoDecay` / Last.fm | `npx tsx scripts/backfill-genre-parada-decay-flags.ts [--prod]` |
| `scripts/backfill-global-genre-snapshots.ts` | Snapshots das paradas por gênero | `npx tsx scripts/backfill-global-genre-snapshots.ts [--week=202627]` |

### Testes Last.fm

```bash
npx tsx scripts/test-bruno-lastfm-import.ts
npx tsx scripts/test-bruno-lastfm-import-fast.ts
npx tsx scripts/test-lastfm-user.ts brunoblv
```

Lógica compartilhada: `lib/lastfm-import.ts` (não é CLI).

---

## Seed de jogos / clube (popula entidades, não é catálogo puro)

| Arquivo | O que faz | Como executar |
|---------|-----------|---------------|
| `prisma/seed.ts` | Dev: users + paradas + songs do pool | `npm run db:seed` |
| `scripts/seed-clube-round-3.ts` | Rodada 3 Clube (álbuns Spotify) | `npm run seed:clube-r3` |
| `scripts/seed-copa-test-artists.ts` | Artistas de teste na copa | `npx tsx scripts/seed-copa-test-artists.ts --copa-id=...` |
| `scripts/seed-copa-random-artists.ts` | Preenche copa com artistas aleatórios | `npx tsx scripts/seed-copa-random-artists.ts --copa-id=...` |
| `scripts/seed-r32-batch1-votes.ts` | Placar R32 batch 1 (one-off) | `npx tsx scripts/seed-r32-batch1-votes.ts` |

---

## Admin UI / cron (enriquecimento contínuo)

Não são CLIs — rodam pela app ou HTTP. Auth de cron: header/query com `CRON_SECRET`. Agenda: `deploy/crontab`.

| Fluxo | O que faz | Onde / como |
|-------|-----------|-------------|
| `GET /api/cron/nightly-catalog-backfill` | Datas, gêneros, bios, metadados (Wiki/MB/LFM/Spotify) | Cron — **desativado** no crontab (2026-07-15) |
| `GET /api/cron/backfill-covers` | Capas Spotify pendentes | Cron — **desativado** |
| `GET /api/cron/release-radar-import` | Sync top 200 artistas Global → release radar | Cron ativo (terça) |
| `GET /api/cron/release-radar` | Varredura de lançamentos | Cron ativo |
| Admin capas | Capas em lote | `/admin/albums/no-cover` |
| Admin clipes YouTube | Clipês oficiais | `/admin/songs/youtube-clips` |
| Admin datas | Datas single/clipe Wiki+MB | `/admin/dados` |
| Admin bios | Bios Wikipedia | `/admin/dados` |
| Admin fontes | Backfill LFM/SPT/MB/WIKI em lote | `/admin/dados` |
| Admin gêneros | Gêneros de músicas | `/admin/song-genres` |
| Admin missing info | Spotify ID/capa/álbum faltando | `/admin/missing-info` |
| Release radar | Import manual top artistas Global | Admin release radar |
| Last.fm import | Import → tracks + Spotify | `/api/lastfm/import` (UI autenticada) |
| Retro publish | Hot 100 / clipes retrospectivos | `/retro` → `POST /api/retro/publish` |

Libs centrais:

- `lib/catalog-nightly-backfill.ts`
- `lib/edicao-de-dados-source-fetch.ts`
- `lib/youtube-music-clip-backfill.ts`
- `lib/resolve-song-genres.ts`
- `lib/resolve-publish-songs.ts`
- `lib/release-radar.ts`
- `lib/retro/generate-history.ts`

---

## Ordem típica para enriquecer o catálogo

1. **Importar paradas** (cria/atualiza Songs) — ex. `seed:boofrnds`, imports Crownnote/xlsx  
2. **`backfill:recording-mbid`** — MB local  
3. **`backfill-single-release-date`** ou **`backfill-song-tags-dates-local`** — datas/tags  
4. **`import:single-release-dates-2000s`** / Billboard debut — datas de planilha/JSON  
5. **`backfill:song-covers`** — capas Spotify  
6. **Admin** (`/admin/dados`, gêneros, YouTube) — o que ainda faltar  

---

## Docs relacionadas

- `YOUTUBE_CLIPS_FEATURE.md` — backfill de clipes YouTube  
- `public/planejamento/hot100retroativo-plano.md` — backfill retro via `/api/retro/publish`  
- `deploy/crontab` — agenda dos crons de catálogo/radar  
- `docs/social-token-refresh.md` — tokens sociais (fora do catálogo)

## Fora do escopo (nomes parecidos)

- `scripts/import-user-photos.ts` — avatares de usuário  
- `.ds-sync/*` — sync de design system  
- `lib/*-playlist-sync.ts` — sync de playlists Spotify a partir de rankings (não CLI de seed)  
- Scripts `rebuild-*` / `recompute-*` — recalculam snapshots/pontos derivados  
