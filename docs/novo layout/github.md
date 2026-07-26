repo: brunoblv/music-app
branch: main
path: (whole repo, reference only)

## Last sync
date: 2026-07-25T04:52:49Z

### Updated in this project
- Core screens: Home, Perfil, Hubs (Álbum/Artista/Música/Review), Comunidades, Busca, Charts (+ Ranking em Clipes/Pódio/Grade variants), Notificações, Conversas, Criar/Editar/Configurar Parada, Login, Onboarding, Descobrir.
- Copa sub-app (tournament) — complete: Home, Ao Vivo, Grupos, Chaveamento, Regras, Meu Time.
- Push game — built from repo: rodada atual (fases Submissão/Ouvir e Rankear/Resultado), Ranking, Histórico, Sobre.
- Hub de Jogos (Jogos.dc.html) linking Push + Copa.
- Comunidade individual (mini-ChartFM detail page).

## Screen map
| Screen | Repo source |
|---|---|
| ChartFM Charts.dc.html | app/chart/[id]/page.tsx (ClassicList), lib/chart-list-layout.ts, components/chart/DesktopPosCell.tsx, components/ui/MovementBadge.tsx, components/ui/Cover.tsx |
| ChartFM Parada.dc.html | app/chart/[id]/page.tsx |
| ChartFM Editar Parada.dc.html | app/chart/[id]/edit/page.tsx |
| ChartFM Ranking em Clipes.dc.html | app/chart/[id]/page.tsx (VideoClipVariant), components/ui/VideoClipCover.tsx |
| ChartFM Ranking Podio.dc.html | app/chart/[id]/page.tsx (GridVariant, PodiumVariant) |
| ChartFM Configuracao Parada.dc.html | app/chart/setup/page.tsx |
| ChartFM Copa Home.dc.html | app/copa/page.tsx, CopaHomeClient.tsx, CopaNav.tsx, CopaBannerCarousel.tsx, CopaArtistAvatar.tsx |
| ChartFM Copa Ao Vivo.dc.html | app/copa/ao-vivo/LiveClient.tsx |
| ChartFM Copa Grupos.dc.html | app/copa/grupos/GroupsClient.tsx |
| ChartFM Copa Chaveamento.dc.html | app/copa/chaveamento/BracketClient.tsx |
| ChartFM Copa Regras.dc.html | app/copa/regras/page.tsx |
| ChartFM Copa Meu Time.dc.html | app/copa/meu-time/MySquadClient.tsx |
| ChartFM Push.dc.html | app/push/page.tsx, PushClient.tsx, PushNav.tsx, components/push/PushRoundHeader.tsx, PushSubmissionView.tsx, PushListenRankView.tsx, PushResultView.tsx, PushAtoms.tsx, push-types.ts, push-helpers.ts |
| ChartFM Push Ranking.dc.html | app/push/ranking/RankingClient.tsx, page.tsx |
| ChartFM Push Historico.dc.html | app/push/historico/page.tsx |
| ChartFM Push Sobre.dc.html | app/push/sobre/page.tsx, components/push/PushIntroView.tsx, push-content.ts |
