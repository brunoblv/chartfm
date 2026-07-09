# Sistema de Postagens Automáticas --- ChartFM

## 1. Objetivo

Criar um módulo completo de **gerenciamento, geração, agendamento e
publicação automática de conteúdo** nas redes sociais do ChartFM.

O sistema deverá integrar:

-   Facebook;
-   Instagram Feed;
-   Instagram Stories;
-   Threads;
-   Telegram;
-   futuramente Reels e outros formatos de vídeo.

Os novos templates visuais estão localizados em:

`/public/modelos`

Utilizar os seguintes formatos:

-   `feed_45` → Instagram Feed, Facebook Feed e Threads;
-   `telegram_11` → Telegram;
-   `story_916` → Instagram Stories e, quando aplicável, Reels.

------------------------------------------------------------------------

## 2. Princípio geral do sistema

As ações realizadas dentro do ChartFM poderão gerar **candidatos a
publicação**, mas isso não significa que deverão ser publicados
imediatamente.

Todo conteúdo automático deverá entrar primeiro em uma **fila editorial
de publicações**.

Fluxo esperado:

1.  Um evento ocorre no site;
2.  Um `SocialEvent` é criado;
3.  O sistema verifica a elegibilidade do conteúdo;
4.  Um `SocialPost` é gerado;
5.  O sistema define a prioridade;
6.  O post entra na fila editorial;
7.  O scheduler encontra o próximo slot disponível;
8.  As artes necessárias são geradas;
9.  Os textos são adaptados para cada plataforma;
10. O conteúdo é publicado no horário agendado;
11. O sistema registra IDs externos, status e eventuais erros.

Nenhuma publicação automática deverá ocorrer em horários aleatórios.

Todos os posts devem ser publicados **exclusivamente em horas
fechadas**, considerando o fuso:

`America/Sao_Paulo`

Slots disponíveis:

-   07:00
-   09:00
-   13:00
-   17:00
-   19:00

Nem todas as plataformas precisam utilizar todos os slots.

------------------------------------------------------------------------

## 3. Estratégia inicial de horários

### 07:00 --- Threads

Conteúdo leve, conversacional ou de descoberta:

-   perguntas para a comunidade;
-   curiosidades;
-   descobertas musicais;
-   comentários sobre movimentações dos charts.

### 09:00 --- Resultados e rankings

Plataformas:

-   Instagram;
-   Facebook;
-   Threads;
-   Telegram.

Conteúdos prioritários:

-   Global 100;
-   Airplay Chart;
-   Albums Chart;
-   resultados de competições;
-   campeões;
-   mudanças importantes nos rankings.

### 13:00 --- Conteúdo editorial e descoberta

Plataformas:

-   Instagram;
-   Facebook;
-   Threads;
-   Telegram.

Conteúdos:

-   avaliações de álbuns;
-   Clube do Álbum;
-   Push;
-   descoberta musical;
-   artistas em destaque.

### 17:00 --- Threads

Conteúdo conversacional:

-   perguntas;
-   curiosidades dos charts;
-   mudanças de posição;
-   chamadas para interação;
-   enquetes e discussões.

### 19:00 --- Jogos e participação

Plataformas:

-   Instagram;
-   Facebook;
-   Threads;
-   Telegram.

Conteúdos:

-   abertura de votação;
-   início de jogo;
-   mudança de fase;
-   Copa ChartFM;
-   chamadas para votar;
-   inscrições.

O sistema não deve obrigatoriamente preencher todos os horários.

------------------------------------------------------------------------

## 4. Limites iniciais por plataforma

Utilizar inicialmente:

-   **Instagram Feed:** máximo recomendado de 2 posts por dia;
-   **Facebook:** máximo de 2 posts por dia;
-   **Telegram:** máximo de 3 posts por dia;
-   **Threads:** máximo de 4 posts por dia;
-   **Stories:** frequência maior permitida e independente do limite do
    feed.

Eventos urgentes ou com prazo limitado poderão ultrapassar esses limites
mediante configuração.

------------------------------------------------------------------------

## 5. Sistema de fila editorial

Criar uma fila com os seguintes estados:

-   `PENDING`
-   `SCHEDULED`
-   `GENERATING`
-   `READY`
-   `PUBLISHING`
-   `PUBLISHED`
-   `PARTIALLY_PUBLISHED`
-   `FAILED`
-   `CANCELLED`

Cada item deverá possuir, no mínimo:

-   `id`
-   `eventType`
-   `entityType`
-   `entityId`
-   `priority`
-   `score`
-   `createdAt`
-   `scheduledAt`
-   `expiresAt`
-   `status`
-   `platforms`
-   `captionInstagram`
-   `captionFacebook`
-   `captionThreads`
-   `captionTelegram`
-   `imageFeed45`
-   `imageTelegram11`
-   `imageStory916`
-   `publishedAt`
-   `facebookPostId`
-   `instagramMediaId`
-   `threadsPostId`
-   `telegramMessageId`
-   `retryCount`
-   `lastError`

------------------------------------------------------------------------

## 6. Sistema de prioridades

Implementar quatro níveis:

-   `CRITICAL`
-   `HIGH`
-   `NORMAL`
-   `LOW`

### CRITICAL

Exemplos:

-   final da Copa;
-   resultado de competição;
-   início de votação com duração limitada;
-   evento que precisa ser divulgado imediatamente no próximo slot.

### HIGH

Exemplos:

-   nova edição da Global 100;
-   nova Airplay Chart;
-   nova Albums Chart;
-   início de jogo;
-   mudança de fase.

### NORMAL

Exemplos:

-   vencedor do Clube do Álbum;
-   álbum que atingiu os critérios de avaliação;
-   Push;
-   descoberta musical.

### LOW

Exemplos:

-   curiosidades;
-   conteúdo evergreen;
-   lembretes;
-   retrospectivas.

Conteúdo com prazo de validade deverá possuir `expiresAt`.

Se não houver slot disponível antes da expiração, o sistema deverá
tentar antecipar o conteúdo ou substituir um item de prioridade
inferior.

------------------------------------------------------------------------

## 7. Painel administrativo

Criar uma tela administrativa dentro de:

`/admin`

O painel deverá permitir:

-   visualizar a fila;
-   visualizar calendário de publicações;
-   filtrar por plataforma;
-   filtrar por tipo de conteúdo;
-   visualizar posts publicados;
-   visualizar posts com erro;
-   criar publicação manual;
-   disparar manualmente a geração de um tipo de conteúdo;
-   reagendar;
-   alterar prioridade;
-   editar legenda;
-   visualizar preview das artes;
-   cancelar publicação;
-   publicar imediatamente;
-   tentar novamente após erro;
-   ativar ou desativar automações individualmente;
-   configurar horários;
-   configurar limites diários por plataforma.

A publicação manual deverá utilizar os mesmos serviços de publicação das
automações.

------------------------------------------------------------------------

## 8. Jogos

Quando um jogo for criado e estiver aberto para inscrições, gerar
conteúdo convidando os usuários a participar.

Quando o jogo mudar de fase, gerar publicação convidando os usuários a
votar.

O conteúdo deve indicar:

-   nome do jogo;
-   fase atual;
-   prazo, quando houver;
-   CTA;
-   link direto.

Posts de votação devem ocupar preferencialmente o slot das **19h**.

------------------------------------------------------------------------

## 9. Copa ChartFM

Quando uma rodada de votação começar, gerar um carrossel com todas as
disputas.

Organizar preferencialmente:

-   **2 confrontos por slide**.

Se o número de confrontos for muito grande:

-   permitir até **3 confrontos por slide**.

O sistema deverá respeitar automaticamente o limite máximo de itens
permitido pela API de cada plataforma e dividir o conteúdo quando
necessário.

### Resultado final da Copa

Ao final da Copa, criar uma arte especial contendo:

-   campeão;
-   segundo lugar;
-   terceiro lugar;
-   medalha de ouro;
-   medalha de prata;
-   medalha de bronze;
-   usuários responsáveis pelas indicações vencedoras, quando aplicável.

Essa publicação terá prioridade `CRITICAL`.

------------------------------------------------------------------------

## 10. Clube do Álbum

Quando um álbum vencer uma edição do Clube do Álbum:

-   criar publicação automática;
-   mostrar capa;
-   mostrar artista;
-   mostrar nome do álbum;
-   mostrar edição do Clube, quando aplicável;
-   convidar a comunidade a ouvir;
-   convidar a avaliar no ChartFM.

O conteúdo poderá entrar na fila e ser publicado no próximo slot
editorial adequado, preferencialmente às **13h**.

------------------------------------------------------------------------

## 11. Avaliações de álbuns

Quando um álbum receber pelo menos **2 avaliações**, ele se torna
elegível para publicação.

Não publicar novamente o mesmo álbum a cada nova avaliação.

Criar regras de cooldown e marcos.

Exemplo:

-   primeira publicação: ao atingir 2 avaliações;
-   nova publicação possível: mudança relevante da nota;
-   nova publicação possível: novo marco configurável;
-   respeitar período mínimo entre posts do mesmo álbum.

A arte deve mostrar:

-   capa;
-   álbum;
-   artista;
-   nota atual.

**Não mostrar a quantidade de reviews na arte.**

A legenda deverá conter um pequeno texto editorial sobre o álbum e
convidar os usuários a avaliá-lo no ChartFM.

O texto não deverá inventar fatos sobre o álbum. Quando não houver dados
editoriais confiáveis disponíveis, utilizar uma chamada neutra baseada
nos dados do ChartFM.

------------------------------------------------------------------------

## 12. Charts

Quando forem publicadas novas edições de:

-   Global 100;
-   Albums Chart;
-   Airplay Chart;

gerar automaticamente posts mostrando o **Top 3**.

Adicionar link para o ranking completo.

Gerar texto editorial baseado nas diferenças entre a edição atual e a
edição anterior.

O sistema deverá detectar acontecimentos como:

-   permaneceu em #1;
-   retornou ao #1;
-   estreou em #1;
-   subiu para #1;
-   perdeu a liderança;
-   maior subida;
-   maior queda;
-   nova entrada no Top 3;
-   número de semanas consecutivas na liderança;
-   retorno ao Top 10.

Exemplo de texto dinâmico:

> X mantém a liderança da Global 100 pela terceira semana consecutiva,
> enquanto Y sobe para a segunda posição e Z estreia no Top 3.

O texto deve ser construído **somente a partir de dados reais do
banco**, sem inventar contexto.

------------------------------------------------------------------------

## 13. Legendas específicas por plataforma

Não utilizar obrigatoriamente a mesma legenda em todas as redes.

### Instagram

Utilizar:

-   texto editorial;
-   CTA;
-   hashtags;
-   linguagem adequada ao feed.

### Facebook

Utilizar:

-   texto um pouco mais informativo;
-   contexto adicional quando necessário;
-   link direto para o ChartFM.

### Threads

Utilizar:

-   texto curto;
-   linguagem conversacional;
-   perguntas;
-   estímulo a respostas.

Exemplo:

> Temos um novo #1 na Global 100 👀\
> Vocês esperavam essa mudança?

### Telegram

Utilizar:

-   mensagem objetiva;
-   boa separação visual;
-   emojis com moderação;
-   link direto para o conteúdo.

------------------------------------------------------------------------

## 14. Hashtags automáticas

Gerar hashtags automaticamente a partir dos artistas envolvidos.

Sempre incluir:

`#ChartFM`

Exemplos:

-   `#ChartFM`
-   `#TaylorSwift`
-   `#LinkinPark`
-   `#Paramore`

Criar uma função para normalizar nomes.

Exemplos:

-   Taylor Swift → `#TaylorSwift`
-   The Weeknd → `#TheWeeknd`
-   Linkin Park → `#LinkinPark`

Evitar:

-   excesso de hashtags;
-   hashtags duplicadas;
-   hashtags inválidas;
-   caracteres especiais incompatíveis.

------------------------------------------------------------------------

## 15. Segurança visual dos templates

Ao gerar imagens automaticamente, respeitar as áreas seguras dos
templates localizados em `/public/modelos`.

Nenhum elemento dinâmico poderá ficar excessivamente próximo:

-   das bordas;
-   do logo;
-   dos títulos;
-   de elementos decorativos;
-   das áreas reservadas para CTA.

Criar margens internas mínimas e áreas seguras específicas por template.

Os textos devem:

-   reduzir o tamanho da fonte dinamicamente quando necessário;
-   possuir tamanho mínimo de fonte;
-   utilizar quebra de linha controlada;
-   utilizar truncamento somente como último recurso;
-   nunca ultrapassar a área disponível.

Antes da publicação, validar automaticamente:

-   texto fora do canvas;
-   sobreposição de elementos;
-   imagem ausente;
-   fonte abaixo do mínimo;
-   violação de área segura;
-   URL de imagem inacessível.

------------------------------------------------------------------------

## 16. Stories e Reels

Stories deverão utilizar:

`story_916`

Priorizar Stories para:

-   votação aberta;
-   últimas horas para votar;
-   novo jogo;
-   resultado;
-   novo chart;
-   álbum do Clube;
-   chamadas rápidas;
-   lembretes de prazo.

Stories podem ser publicados no mesmo dia de um post de feed sem
consumir o limite diário do feed.

O mesmo template poderá servir como base visual para Reels quando houver
necessidade, com adaptação para vídeo e duração apropriada.

------------------------------------------------------------------------

## 17. Prevenção de spam e repetição

O sistema deverá evitar:

-   dois posts consecutivos sobre o mesmo álbum;
-   dois posts semelhantes sobre o mesmo artista;
-   vários conteúdos do mesmo tipo no mesmo dia;
-   repetição da mesma legenda;
-   excesso de posts em sequência;
-   saturação de um único evento.

Criar uma regra de diversidade editorial na fila.

Exemplo adequado:

-   09h --- Global 100;
-   13h --- Álbum avaliado;
-   19h --- Copa ChartFM.

Evitar:

-   09h --- Álbum avaliado;
-   13h --- Álbum avaliado;
-   19h --- Álbum avaliado.

O scheduler deve considerar:

-   prioridade;
-   prazo de validade;
-   diversidade de conteúdo;
-   artista recentemente publicado;
-   entidade recentemente publicada;
-   tipo de conteúdo;
-   limite diário da plataforma.

------------------------------------------------------------------------

## 18. Métricas

Registrar para cada publicação, quando disponível:

-   `platform`
-   `postType`
-   `scheduledHour`
-   `publishedAt`
-   `likes`
-   `comments`
-   `shares`
-   `reach`
-   `impressions`
-   `clicks`

Quando as APIs permitirem recuperar essas métricas, criar um job
periódico de atualização.

No futuro, o sistema deverá calcular desempenho médio por:

-   plataforma;
-   dia da semana;
-   horário;
-   tipo de conteúdo.

A grade inicial de horários deverá ser configurável.

O objetivo é substituir progressivamente benchmarks gerais pelos dados
reais da audiência do ChartFM.

------------------------------------------------------------------------

## 19. Regra central de arquitetura

A regra mais importante do sistema é:

> **Um evento do site não publica diretamente nas redes sociais. Um
> evento cria uma oportunidade de conteúdo, que entra na fila editorial
> e é organizada conforme prioridade, validade, diversidade e
> disponibilidade de horários.**

Conteúdos temporais, como votações e fases da Copa, devem utilizar
`expiresAt` e prioridade superior.

Conteúdos evergreen, como avaliações de álbuns e descobertas, podem
permanecer na fila por vários dias até encontrar o melhor slot.

------------------------------------------------------------------------

## 20. Grade editorial inicial recomendada

A operação inicial deverá considerar três horários principais:

-   **09h:** charts, rankings e resultados;
-   **13h:** álbuns, descoberta, Push e Clube do Álbum;
-   **19h:** jogos, votações, Copa e chamadas para participação.

Os horários:

-   **07h**
-   **17h**

devem funcionar inicialmente como slots adicionais, principalmente para
Threads e conteúdos conversacionais.

Todos os horários devem ser configuráveis no painel administrativo e
sempre utilizar o fuso `America/Sao_Paulo`.

------------------------------------------------------------------------

## 21. Resultado esperado

Ao final da implementação, o ChartFM deverá possuir um sistema editorial
automatizado capaz de:

1.  detectar eventos relevantes do site;
2.  transformar eventos em candidatos a conteúdo;
3.  gerar artes nos formatos corretos;
4.  criar textos específicos para cada plataforma;
5.  adicionar hashtags automaticamente;
6.  organizar conteúdos em uma fila;
7.  distribuir posts em horários exatos;
8.  respeitar prioridade e prazo de validade;
9.  evitar spam e repetição;
10. publicar em Facebook, Instagram, Threads e Telegram;
11. publicar Stories em formato próprio;
12. registrar resultados e erros;
13. permitir controle manual completo pelo painel administrativo;
14. futuramente otimizar horários com base no desempenho real das
    publicações.
