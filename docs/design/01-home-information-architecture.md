# 01 — Home Information Architecture

> [Índice](README.md) · Anterior: [00 — Princípios do Produto](00-product-principles.md) · Próximo: [02 — Arquitetura da Nova Home](02-home-architecture.md)

## Arquitetura da Nova Home

**[TBD]** — desenhar o layout final (wireframe). Estrutura de containers proposta, mapeada aos módulos descritos em [03 — Home Sections](03-home-sections.md):

```
Hero Section
├─ Hoje para Você (resumo pessoal: streak, parada da semana, etc. — sucessor do YourWeekCard)
├─ Pessoas para Conhecer
├─ Descobertas Personalizadas
├─ Reviews
├─ Charts
├─ Communities
├─ Conversas
└─ Feed
Sidebar Direita
```

Componentes existentes reaproveitáveis: `HomeGrid`, `YourWeekCard`, `TimelineTabs`, `CopaLiveFeedCarousel`, `HomeSidebar` (`FriendsRow`, `SuggestedUsers`, `TrendingArtists`, `GlobalTeaser`).

## Fluxo do Usuário

**[TBD]** — mapear os fluxos principais (primeiro acesso/onboarding, usuário recorrente sem notificações novas, usuário recorrente com atividade nova) e o que cada um vê primeiro na nova home.

## Navegação

**[TBD]** — impacto no `Shell`/`Sidebar` de navegação global, caso novas seções (Communities, Conversas) ganhem rotas próprias além da vitrine na Home.
