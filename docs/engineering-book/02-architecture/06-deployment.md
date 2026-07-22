# Capítulo 12 — Deployment

> **ChartFM Engineering Book**
> **Versão:** 1.0
> **Status:** Draft Oficial

---

# Objetivo

Descrever como o ChartFM é construído, testado e implantado — e os cuidados específicos de ambiente que já causaram incidentes reais.

---

# Comandos

- `npm run dev` — servidor de desenvolvimento (Turbopack).
- `npm run typecheck` — `tsc --noEmit`.
- `npm run test` — Vitest, cobrindo `lib/**/*.test.ts`.
- `npm run lint` — `next lint`.
- `npm run build` — `prisma generate && prisma migrate deploy && next build`. O build já aplica migrations pendentes; um build bem-sucedido implica banco migrado.

**Não existe CI nem pre-commit hook configurado.** Nada roda `typecheck`/`test` automaticamente — isso precisa ser feito manualmente antes de considerar qualquer mudança pronta.

---

# Banco de Dados

O `.env` local aponta, por padrão, para um túnel de **produção** em `DATABASE_URL` — não é um banco de dev isolado. Antes de rodar qualquer script que escreva no banco, confirme a porta/host configurados.

Para clonar produção → dev quando um banco de dev isolado for necessário, use `scripts/copy-prod-to-dev.ps1`.

Row-Level Security complementar está definida em `prisma/rls_policies.sql`, aplicada além das checagens de autorização em nível de aplicação.

---

# Scripts Operacionais

O `package.json` expõe uma quantidade grande de scripts `tsx` para operações pontuais: seeds (`db:seed`, `seed:boofrnds`, `seed:clube-r3`), backfills (`backfill:song-covers`, `backfill:recording-mbid`), auditorias (`audit:boofrnds`, `audit:user-points`), recomputação de agregados (`recompute:chart-entry-points`, `rebuild:global-2026`, `refresh:entity-snapshots`), disparo de integrações (`telegram:*`, `mytrl:month`) e migração de credenciais sociais (`social:migrate-credentials`).

Esses scripts escrevem diretamente no banco apontado por `DATABASE_URL` — o mesmo cuidado de ambiente de produção se aplica a todos eles.

Scripts de diagnóstico ou correção ad-hoc que não fazem parte dessa lista permanente devem ser criados como `scripts/_tmp_*.ts` e apagados depois de usados.

---

# Antes de Considerar uma Mudança Pronta

1. `npm run typecheck` sem erros.
2. `npm run test` passando.
3. Se a mudança tocar `middleware.ts`, headers HTTP, ou dados de usuário livres (nome, handle, bio), revisar explicitamente o tratamento de Unicode (ver [Capítulo 8](02-system-architecture.md) e o gotcha correspondente no `CLAUDE.md`).
4. Se a mudança envolver um script que escreve no banco, confirmar contra qual ambiente (`DATABASE_URL`) ele vai rodar antes de executar.

---

# Conclusão

Não há rede de segurança automatizada no ChartFM hoje — nem CI, nem hooks. Isso desloca a responsabilidade de validação inteiramente para quem está fazendo a mudança. `typecheck` e `test` manuais antes de qualquer entrega não são uma sugestão — são o único gate que existe.
