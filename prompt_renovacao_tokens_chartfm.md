# Renovação Automática de Tokens Sociais --- ChartFM

## Objetivo

Analise primeiro a arquitetura existente do projeto ChartFM antes de
implementar qualquer alteração.

O objetivo é implementar um sistema seguro e automático de gerenciamento
e renovação dos tokens das integrações sociais do ChartFM.

## Regras importantes

-   Não reestruture módulos existentes sem necessidade.
-   Não duplique services existentes.
-   Antes de criar arquivos, procure integrações de Facebook, Instagram,
    Threads e Telegram, cron jobs, scheduler, Prisma e serviços de
    configuração.
-   Preserve o padrão arquitetural atual.
-   Não altere fluxos de publicação que já funcionam.
-   Nunca registre tokens completos em logs.
-   Nunca envie tokens ao frontend.
-   Nunca salve tokens no código-fonte.
-   Não sobrescreva um token válido se a renovação falhar.
-   Utilize `America/Sao_Paulo` nos agendamentos.

## Contexto das integrações

### Facebook

A publicação automática utiliza Meta Business, o System User
`chartfmbot`, System User Access Token, acesso à Página ChartFM e Graph
API.

O Facebook não deve usar o mesmo fluxo de refresh do Instagram ou
Threads.

Nesta tarefa: - armazenar e consumir o token com segurança; - permitir
teste de validade; - registrar falhas de autenticação; - não criar
renovação automática fictícia; - não misturar credenciais entre
plataformas.

### Instagram

A integração usa Instagram API with Instagram Login.

O token atual: - é Instagram User Access Token; - já é long-lived; -
possui validade aproximada de 60 dias; - aceita renovação em
`GET https://graph.instagram.com/refresh_access_token`; - usa
`grant_type=ig_refresh_token`; - usa o token atual em `access_token`.

A resposta contém `access_token`, `token_type` e `expires_in`.

Permissões atuais: - `instagram_business_basic`; -
`instagram_business_manage_messages`; -
`instagram_business_content_publish`; -
`instagram_business_manage_insights`; -
`instagram_business_manage_comments`.

### Threads

O token: - é Threads User Access Token; - já é long-lived; - possui
validade aproximada de 60 dias; - aceita renovação em
`GET https://graph.threads.net/refresh_access_token`; - usa
`grant_type=th_refresh_token`; - usa o token atual em `access_token`.

A resposta contém `access_token`, `token_type` e `expires_in`.

### Telegram

O Telegram usa Bot Token e não precisa de renovação periódica nesta
tarefa.

## Objetivo funcional

Implementar um sistema capaz de:

1.  armazenar tokens com segurança;
2.  conhecer a data de expiração;
3.  verificar diariamente tokens que precisam ser renovados;
4.  renovar Instagram e Threads;
5.  persistir o novo token;
6.  recalcular `expiresAt` com `expires_in`;
7.  registrar a última renovação;
8.  registrar erros sem expor credenciais;
9.  implementar retry controlado;
10. preservar o token anterior em caso de falha;
11. preparar renovação manual pelo admin;
12. expor status seguro sem retornar tokens.

## Inspeção obrigatória

Antes de escrever código:

1.  localize o schema Prisma;
2.  identifique o banco;
3.  procure models de social media, integrations, credentials, settings
    e tokens;
4.  procure services de Facebook, Instagram, Threads e Telegram;
5.  procure ScheduleModule, cron e filas;
6.  identifique o sistema de configuração e ENV;
7.  procure criptografia existente;
8.  identifique o padrão de logs.

Antes de implementar, apresente um resumo curto do plano e liste
arquivos a criar ou modificar.

## Modelagem

Se não houver estrutura equivalente, criar algo adaptado ao padrão real:

``` prisma
enum SocialPlatform {
  FACEBOOK
  INSTAGRAM
  THREADS
  TELEGRAM
}

model SocialCredential {
  id              Int             @id @default(autoincrement())
  platform        SocialPlatform  @unique
  accessToken     String
  accountId       String?
  accountUsername String?
  expiresAt       DateTime?
  lastRefreshedAt DateTime?
  lastCheckedAt   DateTime?
  refreshEnabled  Boolean         @default(false)
  refreshFailures Int             @default(0)
  lastError       String?
  lastErrorAt     DateTime?
  createdAt       DateTime        @default(now())
  updatedAt       DateTime        @updatedAt
}
```

Não crie o model se já existir estrutura equivalente.

## Segurança

Reutilize criptografia existente. Se não houver, implemente serviço
específico com algoritmo autenticado apropriado, como AES-256-GCM.

A chave deve vir de variável de ambiente, nunca do banco ou Git.

O token só deve ser descriptografado no momento da chamada externa.
Nunca registrar token, Authorization header, App Secret, URL completa
com token ou resposta integral contendo credenciais.

Como Instagram e Threads retornam tokens renovados, a solução precisa de
armazenamento persistente seguro.

## SocialCredentialService

Criar ou adaptar serviço central com responsabilidades equivalentes a:

-   `getCredential(platform)`
-   `getDecryptedAccessToken(platform)`
-   `updateToken(platform, newToken, expiresIn)`
-   `updateExpiration(platform, expiresIn)`
-   `registerRefreshSuccess(platform)`
-   `registerRefreshFailure(platform, error)`
-   `shouldRefresh(platform)`
-   `getIntegrationStatus()`
-   `validateCredential(platform)`

`getIntegrationStatus()` nunca deve retornar tokens.

Status possíveis: - `HEALTHY` - `REFRESH_DUE` - `EXPIRING_SOON` -
`EXPIRED` - `ERROR` - `NOT_CONFIGURED`

## Regra de renovação

Criar job diário: - uma vez por dia; - timezone `America/Sao_Paulo`; -
horário sugerido: 04:00; - verificar apenas Instagram e Threads.

Regras: - mais de 30 dias restantes: não renovar; - 30 dias ou menos:
renovar; - expirado: registrar erro crítico e não sobrescrever; - sem
`expiresAt`: registrar necessidade de configuração.

Threshold configurável:

``` env
SOCIAL_TOKEN_REFRESH_THRESHOLD_DAYS=30
```

## InstagramTokenService

Renovar usando:

`GET https://graph.instagram.com/refresh_access_token`

Parâmetros: - `grant_type=ig_refresh_token` - `access_token=TOKEN_ATUAL`

Fluxo: 1. carregar token criptografado; 2. descriptografar; 3. chamar
endpoint; 4. validar HTTP; 5. validar `access_token`; 6. validar
`expires_in`; 7. atualizar o banco somente após validação completa; 8.
criptografar novo token; 9. calcular
`expiresAt = now + expires_in segundos`; 10. atualizar
`lastRefreshedAt`; 11. zerar `refreshFailures`; 12. limpar erro anterior
quando apropriado.

Em falha: - preservar token; - incrementar falhas; - salvar erro
sanitizado; - atualizar `lastErrorAt`.

## ThreadsTokenService

Renovar usando:

`GET https://graph.threads.net/refresh_access_token`

Parâmetros: - `grant_type=th_refresh_token` - `access_token=TOKEN_ATUAL`

Aplicar o mesmo fluxo seguro do Instagram.

## Orquestração

Criar ou adaptar `SocialTokenRefreshService` com:

-   `refreshDueTokens()`
-   `refreshPlatform(platform)`
-   `getRefreshCandidates()`

Processar sequencialmente as poucas plataformas para facilitar logs e
diagnóstico.

Ignorar Facebook e Telegram no job de refresh.

## Cron

Se o projeto usa `@nestjs/schedule`, criar algo equivalente a:

``` ts
@Cron('0 0 4 * * *', {
  timeZone: 'America/Sao_Paulo',
})
```

Respeitar o padrão real do projeto. O cron deve apenas chamar o
orquestrador, sem lógica HTTP direta.

## Retry

Implementar retry conservador: - máximo de 3 tentativas; - backoff
progressivo; - somente para erros transitórios.

Não repetir em loop para token inválido, token expirado, permissão
revogada ou autenticação permanentemente inválida.

## Logs

Permitido:

``` text
[SocialTokenRefresh] Checking Instagram credential
[SocialTokenRefresh] Instagram token expires in 28 days
[SocialTokenRefresh] Instagram refresh started
[SocialTokenRefresh] Instagram refresh completed successfully
[SocialTokenRefresh] Threads refresh failed: OAuthException code 452
```

Proibido registrar secrets ou tokens. Criar sanitização de erros se
necessário.

## Concorrência

Evitar renovação simultânea do mesmo token por múltiplas instâncias.

Se houver múltiplos containers ou instâncias, usar lock existente, banco
ou estratégia transacional adequada. Se houver apenas uma instância, não
criar complexidade desnecessária, mas documentar o risco.

## Endpoints administrativos

Se houver padrão administrativo existente, preparar:

`GET /admin/social-integrations/status`

Retornar somente status seguro.

E:

`POST /admin/social-integrations/:platform/refresh`

Permitir refresh manual apenas para Instagram e Threads. Exigir
autenticação de administrador e nunca retornar token.

## Configuração inicial

Criar estratégia segura para cadastrar as credenciais atuais.

Não criar seed com tokens reais.

Preferir comando ou script que leia variáveis de ambiente e grave tokens
criptografados no banco.

Exemplo:

``` env
SOCIAL_TOKEN_ENCRYPTION_KEY=
INSTAGRAM_INITIAL_ACCESS_TOKEN=
INSTAGRAM_ACCOUNT_ID=
THREADS_INITIAL_ACCESS_TOKEN=
THREADS_ACCOUNT_ID=
FACEBOOK_SYSTEM_USER_TOKEN=
FACEBOOK_PAGE_ID=
TELEGRAM_BOT_TOKEN=
```

Documentar quais variáveis iniciais podem ser removidas após a migração.

## Testes

Criar testes para:

1.  cálculo de expiração;
2.  `shouldRefresh`;
3.  mais de 30 dias;
4.  exatamente 30 dias;
5.  próximo da expiração;
6.  expirado;
7.  refresh Instagram com sucesso;
8.  refresh Threads com sucesso;
9.  erro da API;
10. resposta sem `access_token`;
11. resposta sem `expires_in`;
12. preservação do token anterior em falha;
13. gravação do novo token somente após resposta válida;
14. ausência de token nos logs;
15. ausência de token no endpoint de status.

Usar mocks. Não chamar APIs reais nos testes.

## Documentação

Criar Markdown explicando: - arquitetura; - plataformas com refresh; -
frequência do cron; - threshold; - armazenamento; - criptografia; -
ENV; - recuperação de token expirado; - refresh manual; - consulta de
status; - diferenças entre Facebook, Instagram, Threads e Telegram.

## Critérios de aceite

A tarefa estará concluída quando:

1.  Instagram renovar automaticamente;
2.  Threads renovar automaticamente;
3.  novos tokens forem armazenados com segurança;
4.  `expiresAt` for recalculado;
5.  token anterior for preservado em falhas;
6.  Facebook não usar fluxo incorreto de refresh;
7.  Telegram não usar refresh;
8.  cron rodar diariamente;
9.  tokens não aparecerem em logs;
10. houver testes;
11. houver documentação;
12. publicação atual continuar funcionando.

## Arquitetura esperada

``` text
FACEBOOK
└── System User Token
    └── acesso à Página ChartFM

INSTAGRAM
└── Instagram User Access Token
    ├── long-lived
    └── refresh automático

THREADS
└── Threads User Access Token
    ├── long-lived
    └── refresh automático

TELEGRAM
└── Bot Token
    └── sem refresh periódico
```

## Instrução final

Antes de alterar o código:

1.  faça a inspeção do projeto;
2.  identifique o que já existe;
3.  apresente um resumo curto do plano;
4.  liste arquivos que serão criados;
5.  liste arquivos que serão modificados;
6.  informe se haverá migration Prisma;
7.  somente depois implemente.

Não generalize o fluxo de autenticação entre plataformas. Preserve os
fluxos que já funcionam e integre a renovação à arquitetura existente do
ChartFM.
