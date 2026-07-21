# ChartFM

App de charts musicais (Next.js 16 / App Router / Turbopack, Prisma + Postgres, NextAuth). Usuários publicam "paradas" (rankings de músicas) semanais ou diárias, seguem outros usuários, curtem/comentam.

## Comandos

- `npm run dev` — dev server
- `npm run typecheck` — `tsc --noEmit`
- `npm run test` — vitest (`lib/**/*.test.ts`, ver `vitest.config.ts`)
- `npm run lint` — `next lint`
- `npm run build` — inclui `prisma generate && prisma migrate deploy`

Não existe CI nem pre-commit hook configurado. **Antes de considerar uma mudança pronta, rode `typecheck` e `test` manualmente** — nada faz isso por você.

## Ambiente / banco

- `.env` local aponta para um túnel de **produção** em `DATABASE_URL` (porta 5434 neste momento) — não é um banco de dev isolado. Verifique a porta/host antes de rodar qualquer script que escreva no banco.
- `scripts/copy-prod-to-dev.ps1` existe para clonar prod → dev quando necessário.
- Scripts de diagnóstico/backfill ad-hoc devem ser criados em `scripts/_tmp_*.ts` e **apagados depois de usar** — não fazem parte do produto.

## Gotchas conhecidos (bugs de produção já causados por IA — leia antes de mexer nessas áreas)

### 1. `middleware.ts` — headers HTTP só aceitam Latin-1 (2026-07-21)
`middleware.ts` repassa nome/handle do usuário logado para as API routes via headers (`x-api-user-name`, `x-api-user-handle`) para popular logs de auditoria. Nomes de usuário podem ter qualquer caractere Unicode (emoji, aspas curvas, símbolos matemáticos como `𝔐`). Escrever esses valores direto em `Headers.set()` lança `TypeError: Cannot convert argument to a ByteString` — isso **derruba com 500 toda chamada de API do usuário logado** (perfil, charts, tudo), enquanto o mesmo usuário deslogado via tudo normalmente (sem sessão, sem header, sem crash). É fácil não notar em teste manual porque só reproduz com nomes reais fora do ASCII.
- Correção: sempre `encodeURIComponent()` valores de usuário antes de `headers.set()`; decodificar do outro lado com `decodeURIComponent` num try/catch (ver `lib/api-call-context.ts`).
- Regra geral: **qualquer dado de usuário (nome, handle, bio, texto livre) que vira valor de header HTTP precisa ser percent-encoded.** Não assumir ASCII.
- Teste de regressão: `lib/api-call-context.test.ts`.

## Convenções

- Testes ficam junto do código em `lib/**/*.test.ts` (vitest, `environment: "node"`).
- Comentários no código em português, curtos, só quando explicam um "porquê" não óbvio (constraint escondida, workaround, invariante) — não descrevem o que o código faz.
- `lib/mytrl-access.ts` centraliza regras de acesso especiais por handle (ex.: `@bruno` como dono do MyTRL, paradas owner-only, features Spotify liberadas só para alguns handles). Ao adicionar lógica de permissão, checar se já existe uma função lá em vez de duplicar.
