# Renovação automática de tokens sociais — ChartFM

## Visão geral

O ChartFM armazena credenciais das integrações de publicação (Facebook, Instagram, Threads e Telegram) na tabela `social_credentials`, com tokens **criptografados em repouso** (AES-256-GCM). A publicação automática continua usando os publishers em `lib/social/publish/*`, que resolvem o token via `token-resolver` (banco primeiro, fallback para ENV durante a migração).

## Plataformas e refresh

| Plataforma | Refresh automático | Endpoint |
|------------|-------------------|----------|
| Instagram | Sim | `GET https://graph.instagram.com/refresh_access_token` (`grant_type=ig_refresh_token`) |
| Threads | Sim | `GET https://graph.threads.net/refresh_access_token` (`grant_type=th_refresh_token`) |
| Facebook | Não | System User / Page Token — apenas validação e registro de falhas |
| Telegram | Não | Bot Token permanente |

## Cron

- **Rota:** `GET /api/cron/social-token-refresh`
- **Horário:** 04:00 diariamente (`America/Sao_Paulo`)
- **Crontab:** `deploy/crontab`
- Processa apenas Instagram e Threads com `expiresAt` definido e ≤ threshold

## Threshold

```env
SOCIAL_TOKEN_REFRESH_THRESHOLD_DAYS=30
```

- Mais de 30 dias restantes: não renova
- 30 dias ou menos: renova
- Expirado: registra erro crítico e **não sobrescreve** o token

## Armazenamento e criptografia

- Model Prisma: `SocialCredential` (`SocialCredentialPlatform`)
- Chave: `SOCIAL_TOKEN_ENCRYPTION_KEY` (32 bytes em base64 ou hex, ou passphrase derivada com scrypt)
- O token só é descriptografado no momento da chamada externa
- Logs usam prefixo `[SocialTokenRefresh]` e **nunca** incluem tokens

## Variáveis de ambiente

### Obrigatórias (após migração)

```env
SOCIAL_TOKEN_ENCRYPTION_KEY=
SOCIAL_TOKEN_REFRESH_THRESHOLD_DAYS=30
```

### Migração inicial (podem ser removidas depois)

```env
FACEBOOK_PAGE_ID=
FACEBOOK_PAGE_ACCESS_TOKEN=
INSTAGRAM_BUSINESS_ACCOUNT_ID=
INSTAGRAM_ACCESS_TOKEN=
THREADS_USER_ID=
THREADS_ACCESS_TOKEN=
TELEGRAM_BOT_TOKEN=
TELEGRAM_CHAT_ID=
INSTAGRAM_TOKEN_EXPIRES_AT=   # opcional — ISO 8601
THREADS_TOKEN_EXPIRES_AT=     # opcional — ISO 8601
```

Rodar:

```bash
npx tsx scripts/migrate-social-credentials.ts
```

## Recuperação de token expirado

Tokens Instagram/Threads **totalmente expirados** não são renovados automaticamente (a API exige token ainda válido). Nesse caso:

1. Gere um novo token no Meta Developer / fluxo OAuth da plataforma
2. Atualize via script de migração ou upsert manual no banco
3. Defina `expiresAt` correto
4. Opcional: `POST /api/admin/social-integrations/instagram/refresh` (admin) após reconfigurar

## Refresh manual (admin)

Requer sessão privilegiada (`ADMIN` ou `DEV`):

```http
GET /api/admin/social-integrations/status
POST /api/admin/social-integrations/instagram/refresh
POST /api/admin/social-integrations/threads/refresh
```

O status **nunca** retorna tokens.

## Consulta de status

`GET /api/admin/social-integrations/status` retorna por plataforma:

- `HEALTHY`, `REFRESH_DUE`, `EXPIRING_SOON`, `EXPIRED`, `ERROR`, `NOT_CONFIGURED`
- `expiresAt`, `daysUntilExpiry`, `refreshFailures`, `lastError` (sanitizado)

## Concorrência

O deploy atual usa **uma instância** na VPS. Se houver múltiplos containers no futuro, considere lock transacional (`pg_advisory_lock`) antes do refresh.

## Testes

```bash
npm test
```

Testes unitários com mocks — não chamam APIs reais da Meta.
