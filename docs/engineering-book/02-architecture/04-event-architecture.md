# Capítulo 10 — Arquitetura de Eventos

> **ChartFM Engineering Book**
> **Versão:** 1.0
> **Status:** Draft Oficial

---

# Objetivo

Descrever como ações do usuário se transformam em eventos observáveis, notificações e métricas dentro do ChartFM.

---

# Por Que Eventos Importam

O [Capítulo 2](../01-foundation/02-engineering-principles.md) estabelece Analytics como parte da arquitetura, não uma funcionalidade opcional. Sem eventos registrados de forma consistente, perguntas centrais de produto — como pessoas descobrem música, o que aumenta retenção — ficam sem resposta.

---

# Tipos de Eventos no Sistema

## Eventos de Analytics

Registrados em `AnalyticsEvent` e agregados em `AnalyticsDailyStat` via rollups (`lib/analytics-rollup.ts`, `lib/analytics-metrics.ts`). Exemplos de eventos relevantes: chart criada, review publicada, comunidade criada, música descoberta, perfil seguido.

Esses eventos alimentam relatórios e decisões de produto — não são usados para lógica de negócio em tempo real.

## Notificações

`Notification` é gerada quando uma ação de um usuário afeta outro diretamente (curtida, comentário, novo seguidor, etc.), direcionada a um `recipientId`. Funções específicas de domínio (ex.: `lib/notifications.ts`, `lib/copa-notifications.ts`, `lib/global-weekly-notifications.ts`) encapsulam quando e como cada notificação é criada.

## Broadcast / Anúncios

`ScheduledAnnouncement` e `SystemFeedPost`, processados por `lib/process-scheduled-announcements.ts` e `lib/dispatch-announcement.ts`, cobrem comunicação da plataforma para os usuários — anúncios agendados e posts do sistema no Feed.

## Distribuição Externa

Alguns eventos de produto (ranking global publicado, novidades da semana) são distribuídos para fora da plataforma via Telegram (`lib/telegram.ts`, `lib/telegram-card.ts`) e TikTok (`lib/tiktok-bot.ts`).

## Logs de Auditoria e Erro

`ApiRequestLog` e `SiteAuditLog` registram quem fez o quê via API, populados a partir do contexto repassado pelo `middleware.ts` (ver o cuidado com encoding de Unicode em headers, [Capítulo 8](02-system-architecture.md)). `SystemErrorLog` captura erros de sistema para diagnóstico.

---

# Onde Este Sistema Não É um Event Bus Formal

Diferente de uma arquitetura orientada a eventos com um message broker, o ChartFM hoje dispara essas ações de forma síncrona e direta, dentro do fluxo de request ou de scripts agendados — não há um barramento de eventos desacoplado.

O princípio de baixo acoplamento do [Capítulo 2](../01-foundation/02-engineering-principles.md) ("ambos conhecem apenas o Event Bus") descreve uma aspiração de desenho, útil como critério ao avaliar acoplamento entre módulos, mesmo sem um Event Bus literal implementado hoje. Ao adicionar uma nova propagação de evento (ex.: uma chart nova precisa notificar seguidores e gerar analytics), prefira centralizar a lógica em uma função de `lib/` dedicada em vez de espalhar chamadas diretas entre módulos de domínio não relacionados.

---

# Regra Prática ao Adicionar uma Nova Ação de Usuário

Ao implementar uma funcionalidade que representa uma ação relevante do usuário, considere explicitamente:

1. Precisa de um evento de Analytics? Qual?
2. Alguém deve ser notificado?
3. Deve aparecer no Feed ou gerar atividade visível para outros usuários?
4. Precisa de auditoria (ex.: ações administrativas)?

Nem toda ação precisa das quatro coisas, mas a pergunta deve ser feita conscientemente, não esquecida por omissão.

---

# Conclusão

Eventos no ChartFM cobrem quatro necessidades distintas — Analytics, notificação social, comunicação da plataforma e auditoria — implementadas hoje de forma direta dentro do fluxo de aplicação. Qualquer nova funcionalidade que gere uma ação relevante do usuário deve considerar essas quatro camadas antes de ser considerada completa.
