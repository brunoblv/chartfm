# Investigando erros de conexão e falhas de servidor — ChartFM

## Contexto

Guia de passo a passo para diagnosticar relatos como "deu erro de conexão", "não consegui postar", "não foi possível carregar o perfil" — cobrindo tanto falha real de servidor (banco indisponível, exceção não tratada) quanto desconexão do lado do usuário.

Nasceu de dois incidentes reais:
- Publicação de parada demorando (~90s de enriquecimento via Spotify) e caindo em "Erro de conexão" mesmo quando a parada já tinha sido salva — corrigido com retry automático em [app/create/page.tsx](../app/create/page.tsx#L419-L465).
- Usuária não conseguindo carregar o perfil por esgotamento do pool de conexões do Prisma (`connection_limit: 5`, o padrão quando não configurado) — sem log nenhum acessível fora do PM2 até a aba "Logs de sistema" existir.

## 1. Confira a aba "Logs de sistema" (`/admin/logs`)

Primeiro lugar a olhar — não precisa de SSH.

1. Acesse `/admin/logs` logado como admin (role `ADMIN`/`DEV`).
2. Clique na aba **"Logs de sistema"** (abre automaticamente nela se houver erros recentes).
3. Busque por rota (`profile`, `charts`) ou trecho da mensagem de erro.
4. Clique em **"Ver stack trace"** na linha do erro para o detalhe completo.
5. Olhe o **horário** e a **rota (`scope`)** de cada ocorrência — a mesma mensagem aparecendo em várias rotas diferentes ao mesmo tempo (como no caso do pool esgotado) é sinal de problema de infra, não bug isolado de uma rota.

Essa tabela (`SystemErrorLog`, ver [lib/system-error-log.ts](../lib/system-error-log.ts)) é alimentada por:
- [instrumentation.ts](../instrumentation.ts) — captura global de exceções não tratadas que o Next relança em qualquer rota `app/api/**`.
- Chamadas explícitas de `logSystemError()` nos `catch` das rotas que já tratavam erro manualmente e retornavam resposta própria: `POST /api/charts`, `GET /api/charts/[id]`, `GET /api/profile/[handle]` (+ `reviews`/`paradas`), `POST /api/analytics/track`, `auth.jwt-refresh`.

**Limitação importante:** a escrita do log é *best-effort* — se o banco estiver indisponível (o cenário mais grave que essa tabela existe para capturar), a própria gravação do log pode falhar silenciosamente. Se um incidente forte não aparecer completo na aba, vá para o passo 2.

Retenção: 14 dias, purgado junto com os outros logs em [lib/analytics-rollup.ts](../lib/analytics-rollup.ts).

## 2. Se não achar nada (ou o app nem respondia), vá pro log do PM2

```bash
pm2 logs chartfm --nostream --lines 500 > /tmp/log.txt
grep -iE "PrismaClientInitializationError|ECONNREFUSED|connection pool|Timed out" /tmp/log.txt

# Troque HANDLE_OU_ROTA pelo termo real antes de rodar (ex.: hyune, profile/\[handle\])
grep -i "HANDLE_OU_ROTA" /tmp/log.txt
```

## 3. Classifique o tipo de erro encontrado

| O que aparece | Significa |
|---|---|
| `Timed out fetching a new connection from the connection pool` | Pool do Prisma esgotado. Confira `connection_limit` na `DATABASE_URL` da VPS. |
| `PrismaClientInitializationError` + `Can't reach database server` | Postgres fora do ar ou inacessível (rede, container caído). |
| Erro só numa rota específica, sem padrão de horário repetido | Provável bug de código isolado — olhe o stack trace pra achar o arquivo/linha. |
| Nada nos logs, e o usuário relatou "erro de conexão" | Provável falha do lado do cliente (rede dele) — sem 5xx no servidor, é desconexão, não bug. |

## 4. Confirme o estado atual da infra (se suspeitar de pool/banco)

```bash
# Quantas conexões o Postgres está usando agora — conecta com a mesma DATABASE_URL
# da app (evita problema de .pgpass/autenticação do usuário "postgres" do sistema).
# Rode a partir da raiz do projeto (onde está o .env).
psql "$(grep '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"')" -c "SELECT count(*) FROM pg_stat_activity;"
psql "$(grep '^DATABASE_URL=' .env | cut -d= -f2- | tr -d '"')" -c "SHOW max_connections;"

# Se preferir/precisar como usuário postgres do sistema, use -i (login shell):
# sudo -iu postgres psql -c "SELECT count(*) FROM pg_stat_activity;"

# Confere se o processo da app está de pé e há quanto tempo
pm2 list
pm2 describe chartfm
```

`connection_limit: 5` é o padrão do Prisma (`núcleos_de_CPU * 2 + 1`) quando a `DATABASE_URL` não define o parâmetro explicitamente — e já é pouco para tráfego concorrente real. Ajuste assim, se necessário:

```
DATABASE_URL="postgresql://user:pass@host:5432/db?schema=public&connection_limit=20&pool_timeout=20"
```

Dimensione considerando `max_connections` do Postgres e quantas instâncias PM2 rodam a app (`pm2 list` — cada instância abre seu próprio pool).

## 5. Se suspeitar de mudança de código, cheque o histórico

```bash
# Troque ARQUIVO_SUSPEITO pelo caminho real antes de rodar
git log --oneline -20 -- ARQUIVO_SUSPEITO
git log -p -3 -- ARQUIVO_SUSPEITO
```

## 6. Documente a causa e a correção

Depois de confirmar, registre a causa e o que foi corrigido — commit, ou uma atualização neste documento se for um padrão recorrente.
