# Projeto: TikTok Growth Community Bot

## Objetivo

Criar um bot para Telegram que gerencie uma comunidade onde todos os
membros ajudam uns aos outros a crescer no TikTok.

Fluxo principal:

1.  Usuário entra no grupo.
2.  Bot dá boas-vindas.
3.  Bot solicita o cadastro do usuário do TikTok.
4.  O perfil é salvo no banco.
5.  O bot divulga automaticamente os perfis cadastrados em intervalos
    regulares.
6.  Todos seguem uns aos outros, promovendo crescimento orgânico.

------------------------------------------------------------------------

# Stack Tecnológica

## Backend

-   Node.js
-   TypeScript
-   NestJS
-   Prisma ORM
-   PostgreSQL

## Integrações

-   Telegram Bot API
-   Scheduler (Cron Jobs)

------------------------------------------------------------------------

# Funcionalidades

## Boas-vindas

Ao detectar `new_chat_members`, o bot envia:

> 👋 Bem-vindo ao TikTok Growth!
>
> Para participar das divulgações automáticas, cadastre seu usuário do
> TikTok.

Botão:

-   Cadastrar meu TikTok

------------------------------------------------------------------------

## Cadastro

Aceitar:

-   @usuario
-   usuario
-   https://www.tiktok.com/@usuario

Salvar apenas:

    usuario

Validações:

-   remover @
-   converter para lowercase
-   impedir duplicidade
-   validar caracteres

------------------------------------------------------------------------

## Perfil do usuário

Campos:

-   Telegram ID
-   Nome
-   Username Telegram
-   Username TikTok
-   Data de cadastro
-   Ativo
-   Última divulgação
-   Quantidade de divulgações

------------------------------------------------------------------------

## Divulgação Automática

Executar a cada 30 minutos.

Selecionar usuários de forma justa, priorizando quem está há mais tempo
sem divulgação.

Mensagem:

> 🚀 Hora de crescer juntos!
>
> Siga estes criadores:
>
> 🎵 @usuario1
>
> 🎵 @usuario2
>
> 🎵 @usuario3
>
> 🎵 @usuario4
>
> 🎵 @usuario5
>
> Depois deixe um ❤️ no vídeo mais recente deles.

Atualizar:

-   last_shared_at
-   share_count

------------------------------------------------------------------------

# Comandos

-   /start
-   /cadastro
-   /perfil
-   /editar
-   /remover
-   /ajuda

## Administrador

-   /stats
-   /broadcast
-   /forcar_divulgacao
-   /usuarios
-   /ban

------------------------------------------------------------------------

# Banco de Dados

## users

``` sql
id
telegram_id BIGINT UNIQUE
telegram_username
telegram_name
tiktok_username UNIQUE
created_at
updated_at
active
last_shared_at
share_count
```

## groups

``` sql
id
telegram_group_id
title
created_at
active
```

## group_members

``` sql
id
group_id
user_id
joined_at
left_at
is_member
```

## share_history

``` sql
id
user_id
group_id
shared_at
message_id
```

## bot_settings

``` sql
id
share_interval
profiles_per_post
welcome_message
enabled
```

------------------------------------------------------------------------

# Cron Jobs

-   A cada 30 minutos: divulgar 5 perfis.
-   Meia-noite: resetar estatísticas diárias.
-   Domingo: enviar mensagem de incentivo.

------------------------------------------------------------------------

# API REST

    GET    /users
    GET    /ranking
    GET    /random
    POST   /register
    PATCH  /user
    DELETE /user

------------------------------------------------------------------------

# Estrutura de Pastas

``` text
src/
├── bot/
│   ├── commands/
│   ├── callbacks/
│   ├── updates/
│   └── middlewares/
├── users/
├── groups/
├── shares/
├── scheduler/
├── telegram/
├── tiktok/
├── prisma/
└── app.module.ts
```

------------------------------------------------------------------------

# Melhorias Futuras

-   Sistema de pontos
-   Badges
-   Missões
-   Ranking
-   Painel administrativo
-   Website público
-   Canal de divulgação automática
-   Categorias por nicho
-   Confirmação periódica de participação
-   Estatísticas individuais
-   Detecção automática de saída do grupo
