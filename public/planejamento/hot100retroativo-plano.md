# Hot 100 Retrospectivo — Plano de Implementação

> Companheiro técnico de `hot100retroativo.md` (visão) e `tela.png` (UI).
> Objetivo: sair da ideia para um plano executável por fases, com fórmulas definidas.

---

## 0. Decisões de arquitetura (fechadas)

| Decisão | Escolha |
|---|---|
| **Fonte pré-2010** | `overall playcount` do Last.fm como **força relativa** (ex.: música de 500 plays é forte vs. o resto do pool). |
| **Fonte pós-Out/2010** | plays reais do mês via `fetchTracksBetweenUnix`. |
| **Universo de músicas** | toda a biblioteca do usuário (`fetchTopTracks("overall")`) casada com `Song` já existente. |
| **Histórico Top20 / Pico / #1** | agregação sobre os `ChartEntry` já publicados do usuário (não precisa de dado novo). |
| **Importance** | **global por música/usuário**, calculada 1x e depois **congelada** se editada manualmente. |
| **Era Weight** | **calculada** (função da distância release→chart), com override manual opcional por ano. |
| **Chart gerado** | recalculado sob demanda; só os **overrides manuais** são persistidos. Publicar = gerar uma `Parada` real (reusa feed/export). |
| **Reuso máximo** | `Song.singleReleaseDate` / `youtubeReleaseDate` / `isrc` / `recordingMbid` e `ChartEntry.peak/weeks/position` já cobrem quase toda a tabela do mockup. |

---

## 1. Modelo de dados (Prisma) — só o que falta

Nada de tabela de chart pesada no MVP. Persistimos apenas o ajuste humano.

```prisma
// Perfil retrô GLOBAL por usuário+música (importance, peak potential, ajuste, nota)
model RetroSongProfile {
  id                  String   @id @default(cuid())
  userId              String   @map("user_id")
  songId              String   @map("song_id")
  importance          Int?     // 0-100; null = usar valor calculado
  importanceLocked    Boolean  @default(false) @map("importance_locked")
  peakPotential       String?  @map("peak_potential") // "1","top3","top5","top10","top20","top40","top100","out"
  peakPotentialLocked Boolean  @default(false) @map("peak_potential_locked")
  manualAdjustment    Int      @default(0) @map("manual_adjustment") // -50..+50
  note                String?  // "marcou minha adolescência"
  createdAt           DateTime @default(now()) @map("created_at")
  updatedAt           DateTime @updatedAt @map("updated_at")

  @@unique([userId, songId])
  @@index([userId])
  @@map("retro_song_profiles")
}

// Override de Era Weight por ano (opcional — fase 3). Ex.: Mr. Brightside 2005=95, 2010=75
model RetroEraOverride {
  id      String @id @default(cuid())
  userId  String @map("user_id")
  songId  String @map("song_id")
  year    Int
  weight  Int    // 0-100
  @@unique([userId, songId, year])
  @@map("retro_era_overrides")
}
```

Publicação de um chart retrô = criar uma `Parada`/`Chart`/`ChartEntry` normal → aproveita likes, feed, export e página pública que já existem.

---

## 2. Motor de cálculo (determinístico) — o coração

Arquivo novo: `lib/retro/scoring.ts`. Tudo puro/testável (vitest), sem I/O.

### 2.1 Elegibilidade
`chartDate` = último dia do mês selecionado (ex.: 31/05/2005).
```
elegível se releaseRef <= chartDate
releaseRef = singleReleaseDate ?? albumReleaseDate ?? youtubeReleaseDate
se nenhuma existir → status "precisa liberação manual" (não entra até o usuário liberar)
```
- **Modo Histórico**: só músicas com scrobble real no/antes do período.
- **Modo Retrospectivo**: qualquer música elegível, mesmo descoberta anos depois (mas nunca antes do lançamento).

### 2.2 Força do período (a peça pré-2010)
```
base = normalizeLog(overallPlaycount, pool)      // log1p normalizado 0..1 no pool elegível
                                                 // log: 500 vs 2000 plays ≠ 4x de força
períodoStrength =
   pós-2010:  normalizeLog(playsDoMêsReal, pool)
   pré-2010:  base × eraWeight                    // eraWeight impede que descoberta recente domine chart antigo
```

### 2.3 Era Weight  `EW(chartDate, releaseRef) ∈ 0..1`
```
mesesDesdeRelease = meses(chartDate - releaseRef)
mesesDesdeRelease < 0        → 0 (não elegível)
0..12 meses                  → 1.0        (auge)
> 12 meses                   → decai exponencial até piso ~0.30
override manual por ano      → substitui o calculado
```

### 2.4 Importance (0-100) — global, congela ao editar
Pesos do spec:
```
40%  overallPlaycount   (log-normalizado vs pool)
25%  semanas na Top20    (normalizado)
15%  qtd de #1           (normalizado)
10%  melhor pico         (invertido: #1 = 100)
10%  recência dos plays  (lastScrobble mais recente = maior)
= Importance
```
Ao usuário editar → `importanceLocked = true`, **nunca mais recalcula**.

### 2.5 Score Final (0-100) — por período
Pesos do spec:
```
30%  plays do período    (períodoStrength da 2.2)
30%  Importance / 100
15%  histórico Top20      (composto pico+semanas)
10%  recência do lançamento (mais perto do chartDate = maior)
10%  data do clipe        (clipe lançado antes do chartDate = bônus)
 5%  ajustes manuais      (manualAdjustment -50..50 mapeado)
= Score Final
```

### 2.6 Derivados
- **Peak Potential**: calculado do Score/HitLevel; travável pelo usuário. Algoritmo nunca sugere acima dele sem autorização.
- **Hit Level**: Diamond/Platinum/Gold/Silver/Bronze por faixas de Importance + plays + #1 + semanas.
- **Prioridade S/A/B/C/D**: banding do Score + Hit Level.
- **Confiança** Alta/Média/Baixa: quantos campos existem (release date? plays reais? histórico Top20?). Pré-2010 sem histórico → Média/Baixa.
- **Permanência (semanas) + trajetória de Pico**: **Fase 5** (simulação), não bloqueia o MVP.

---

## 3. Camada de dados / serviço

`lib/retro/build-pool.ts` — monta o pool elegível para (ano, mês, modo):
1. `fetchTopTracks("overall", ~1000)` → playcount total por faixa.
2. Casa com `Song` (reusa o matcher de `lastfm-import.ts`) → pega release dates, isrc, clipe.
3. Pós-2010: `fetchTracksBetweenUnix(inícioMês, fimMês)` → plays reais do período.
4. Agrega `ChartEntry` do usuário (charts com `weekStartDate <= chartDate`) → pico, semanas, #1.
5. Aplica `RetroSongProfile` (overrides) e roda o motor da seção 2.
6. Cache do pool por (usuário, período) — Last.fm é lento; recalcular score é barato.

---

## 4. API

```
GET  /api/retro/chart?year=2005&month=5&mode=retrospectivo   → pool + scores calculados
POST /api/retro/song-profile   { songId, importance?, peakPotential?, manualAdjustment?, note? }
POST /api/retro/song/:id/release   { releaseDate }   // liberação manual de elegibilidade
POST /api/retro/publish   { year, month, mode }      // cria Parada/Chart a partir do resultado
```

---

## 5. UI (`app/retro/` ou dentro de "Paradas")

Fielmente ao `tela.png`:
- **Header de controle**: seletor Ano/Mês, seletor de Modo (Histórico/Retrospectivo), badges de fontes, botão Recalcular.
- **Faixa de stats**: elegíveis, com plays no período, entraram na Top20, tiveram #1, diamonds.
- **Tabela** (virtualizada, paginada 50/pág): capa, música/artista, plays mês/total, datas (single/clipe/álbum), Top20 (entrada/pico/semanas/#1), Importance (medidor), Peak Potential, Hit Level, Prioridade, Score Final. Busca + Filtros + Export.
- **Painel lateral "Detalhes da música"**: abas Visão geral / Histórico / Ajustes / DNA Musical; medidor de Score; "Por que essa música está aqui?" (motivos ✔); decomposição dos pesos; slider de Importance 0-100 + ★★★★★; campo de observação pessoal.

Reaproveitar componentes de medidor/tabela que já existem no app onde der.

---

## 6. Fases (ordem de entrega)

| Fase | Entrega | Dá pra demonstrar? |
|---|---|---|
| **F1** | Schema (`RetroSongProfile`) + migração | — |
| **F2** | `lib/retro/scoring.ts` + testes vitest (elegibilidade, importance, score, era weight) | ✅ testes verdes com casos do spec (Mr. Brightside, Firework) |
| **F3** | `build-pool.ts` + `GET /api/retro/chart` | ✅ JSON de um chart de Maio/2005 |
| **F4** | Página + tabela + stats (read-only) | ✅ tela do mockup funcionando |
| **F5** | Painel lateral + edição (Importance, ajuste, nota, liberação manual) + persistência | ✅ editar e recalcular |
| **F6** | Publicar como `Parada` + export | ✅ chart retrô no feed |
| **F7** | Permanência/Pico (simulação) + "sistema aprende" (fase futura) | — |

**Recomendação:** começar por **F2** (motor + testes) antes de qualquer UI. É onde está o risco real, é 100% testável sem Last.fm, e valida as fórmulas do spec com os próprios exemplos que você escreveu.

---

## 7. Riscos / pontos de atenção
- **Matching Last.fm → Song**: nome/artista sujos. Reusar o canonicalizador de `lastfm.ts` (`canonicalizeTrackName`) já resolve muito.
- **Release dates faltando**: muitas faixas antigas sem `singleReleaseDate`. O fallback álbum→clipe→manual cobre; a métrica de Confiança deve refletir isso.
- **Custo Last.fm**: `overall` com ~1000 faixas é paginado e lento → cache obrigatório do pool.
- **Normalização por pool**: log1p evita que 1 outlier de 10k plays achate todo o resto.
