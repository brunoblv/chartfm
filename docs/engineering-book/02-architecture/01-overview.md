# Capítulo 7 — Visão Geral da Arquitetura

> **ChartFM Engineering Book**
> **Versão:** 1.0
> **Status:** Draft Oficial

---

# Objetivo

Este capítulo abre a Parte 2 do livro. Enquanto a Parte 1 explica por que o ChartFM existe, esta parte explica como o sistema é construído. Este capítulo dá o mapa geral; os capítulos seguintes aprofundam cada peça.

---

# Stack

- **Next.js 16 (App Router, Turbopack)** — frontend e backend no mesmo projeto. Páginas em `app/`, API routes em `app/api/`.
- **Prisma + PostgreSQL** — ORM e banco relacional. Schema único em `prisma/schema.prisma`, migrations versionadas em `prisma/migrations`.
- **NextAuth** — autenticação (`lib/auth-config.ts`, `lib/auth-options.ts`), com suporte a login por credenciais, Google e conexões OAuth de Spotify/YouTube para features específicas.
- **TypeScript** em todo o código de aplicação e scripts.
- **Vitest** para testes (`lib/**/*.test.ts`).

---

# Formato Geral

O ChartFM é um monólito modular: uma única aplicação Next.js, um único banco Postgres, sem microsserviços. A modularidade vem da organização em `lib/` (um arquivo por responsabilidade de domínio) e do modelo de dados, não de fronteiras de rede.

Essa escolha é deliberada: para o estágio atual da plataforma, a complexidade operacional de múltiplos serviços não se paga. Ver [Capítulo 2](../01-foundation/02-engineering-principles.md), princípio de simplicidade.

---

# Camadas

```text
Interface (app/**/page.tsx, componentes)
        ↓
API Routes (app/api/**/route.ts)
        ↓
Lib / Services (lib/*.ts — regras de negócio)
        ↓
Prisma Client (lib/prisma.ts)
        ↓
PostgreSQL
```

`middleware.ts` intercepta requisições antes das API routes para repassar contexto de sessão (nome/handle do usuário logado) via headers — ver o gotcha de Unicode documentado no `CLAUDE.md` antes de mexer nessa camada.

Detalhamento de cada camada e suas responsabilidades está no [Capítulo 8 — Arquitetura do Sistema](02-system-architecture.md).

---

# Integrações Externas

O ChartFM depende de múltiplos provedores externos para catálogo musical e distribuição:

- **Spotify, Deezer, YouTube Music, MusicBrainz, Last.fm** — metadados de catálogo e, em alguns casos, sincronização de conta do usuário.
- **Telegram** — distribuição de conteúdo (rankings globais, novidades) para canais externos.
- **TikTok** — bot de distribuição de conteúdo.

Nenhuma dessas integrações deve se tornar uma dependência estrutural do produto — se um provedor externo cair, o ChartFM continua funcionando com os dados que já possui.

---

# Onde Ir a Partir Daqui

- [Capítulo 8 — Arquitetura do Sistema](02-system-architecture.md): detalhamento de camadas e convenções.
- [Capítulo 9 — Modelo de Domínio](03-domain-model.md): entidades principais do Prisma schema.
- [Capítulo 10 — Arquitetura de Eventos](04-event-architecture.md): Analytics, notificações e broadcast.
- [Capítulo 11 — Fluxo de Dados](05-data-flow.md): como uma ação do usuário se propaga pelo sistema.
- [Capítulo 12 — Deployment](06-deployment.md): build, ambiente e banco de produção.
