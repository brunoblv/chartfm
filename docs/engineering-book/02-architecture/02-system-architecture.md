# Capítulo 8 — Arquitetura do Sistema

> **ChartFM Engineering Book**
> **Versão:** 1.0
> **Status:** Draft Oficial

---

# Objetivo

Detalhar as camadas apresentadas no [Capítulo 7](01-overview.md): o que cada uma faz, o que ela não deve fazer, e como elas se comunicam.

---

# Interface (`app/**`)

Páginas e componentes React (App Router). Responsável apenas por apresentação e interação.

Não deve conter regras de negócio — chamadas a `lib/*` diretamente do lado servidor (Server Components) ou via `fetch` para API routes do lado cliente.

Módulos de página relevantes: `app/chart`, `app/album`, `app/artist`, `app/song`, `app/community`, `app/mytrl`, `app/push`, `app/copa`, `app/editorial`, `app/discover`, `app/feed`, `app/admin`.

---

# Middleware (`middleware.ts`)

Roda antes das API routes. Hoje sua principal responsabilidade é repassar identidade do usuário logado (nome, handle) via headers HTTP para popular logs de auditoria (`ApiRequestLog`, `SiteAuditLog`).

**Atenção:** valores de usuário podem conter qualquer caractere Unicode e headers HTTP só aceitam Latin-1/ByteString. Todo valor de usuário passado por `Headers.set()` precisa ser `encodeURIComponent()`-ado antes e decodificado do outro lado dentro de um try/catch. Ver `lib/api-call-context.ts` e o gotcha documentado no `CLAUDE.md`. Esse bug já derrubou produção uma vez — não é uma preocupação teórica.

---

# API Routes (`app/api/**/route.ts`)

Porta de entrada HTTP. Responsabilidades:

- Validar entrada.
- Autenticar (via NextAuth / `lib/auth-options.ts`) e autorizar (via `lib/permissions.ts`, `lib/mytrl-access.ts`, `lib/admin-auth.ts`, `lib/community-auth.ts`).
- Encaminhar para a camada de `lib/` (services).
- Traduzir o resultado em uma resposta HTTP.

API routes não devem conter regra de negócio complexa nem acessar o Prisma diretamente para lógica não trivial — isso pertence a `lib/`.

---

# Lib / Services (`lib/*.ts`)

Onde vivem as regras de negócio. Este diretório é organizado por domínio, não por camada técnica — um arquivo por responsabilidade (`lib/chart-entry-points.ts`, `lib/push-scoring.ts`, `lib/mytrl-access.ts`, etc.), em vez de uma classe `Service` genérica por entidade.

Antes de adicionar lógica de permissão, verifique `lib/mytrl-access.ts` e `lib/permissions.ts` — regras de acesso especiais por handle já centralizadas ali não devem ser duplicadas em outro lugar.

Testes de unidade para esta camada ficam ao lado do arquivo (`lib/*.test.ts`), rodados com Vitest.

---

# Acesso a Dados (`lib/prisma.ts`, `prisma/schema.prisma`)

Prisma Client é a única forma de acesso ao Postgres. Nenhuma camada acima de `lib/` deve importar o cliente Prisma diretamente — sempre passar por uma função de `lib/`.

Row-Level Security adicional está definida em `prisma/rls_policies.sql`, complementar às checagens de autorização em nível de aplicação.

---

# Scripts (`scripts/*.ts`)

Executados via `tsx`, fora do ciclo de request HTTP: seeds, backfills, auditorias, rebuilds de snapshot, integrações de disparo manual (Telegram, TikTok).

Scripts de diagnóstico ou backfill pontuais devem seguir o padrão `scripts/_tmp_*.ts` e ser apagados depois de usados — eles não fazem parte do produto e não devem se acumular no repositório.

Como `.env` local aponta por padrão para o túnel de produção (ver `CLAUDE.md`), qualquer script que escreve no banco exige checagem da porta/host antes de rodar.

---

# Convenções Que Atravessam Camadas

- TypeScript em tudo.
- Comentários em português, curtos, só para explicar um "porquê" não óbvio.
- Nomes de usuário e outros dados livres nunca devem ser tratados como ASCII-safe — percent-encode antes de virar header HTTP.

---

# Conclusão

A arquitetura do ChartFM prioriza fronteiras claras de responsabilidade dentro de um único deploy, em vez de fronteiras de rede entre serviços. Isso mantém a complexidade operacional baixa enquanto o produto ainda está descobrindo sua forma final — ver [Capítulo 2](../01-foundation/02-engineering-principles.md).
